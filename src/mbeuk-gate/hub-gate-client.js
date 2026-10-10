import { NETWORK_ERROR_MESSAGE } from "./gate-messages.js";

const SESSION_KEY = "mbeuk_hub_gate_session";

export class HubGateError extends Error {
  constructor(message, code = "HUB_GATE_ERROR", status = 0, details = null) {
    super(message);
    this.name = "HubGateError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class HubGateClient {
  constructor({ functionsUrl, anonKey, fetchImpl = globalThis.fetch, storage = globalThis.localStorage }) {
    if (!functionsUrl) throw new Error("MbeukHubGate: functionsUrl requis.");
    if (!anonKey) throw new Error("MbeukHubGate: anonKey requis.");
    this.functionsUrl = functionsUrl.replace(/\/+$/, "");
    this.anonKey = anonKey;
    this.fetchImpl = fetchImpl;
    this.storage = storage;
    this.session = this.readSession();
  }

  readSession() {
    try {
      return JSON.parse(this.storage?.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  saveSession(payload) {
    this.session = {
      hubUserId: payload.hub_user_id,
      hubSessionToken: payload.hub_session_token,
      hubRefreshToken: payload.hub_refresh_token,
      hubExpiresAt: payload.hub_expires_at,
      supabaseAccessToken: payload.supabase_session?.access_token || null,
      email: payload.email,
      fullName: payload.full_name || "",
    };
    try {
      this.storage?.setItem(SESSION_KEY, JSON.stringify(this.session));
    } catch {
      // Session en mémoire si le stockage est indisponible.
    }
    return this.session;
  }

  clearSession() {
    this.session = null;
    try {
      this.storage?.removeItem(SESSION_KEY);
    } catch {
      // Aucun stockage à nettoyer.
    }
  }

  sessionHeaders() {
    const session = this.session;
    if (!session) return {};
    return {
      "X-Hub-User-Id": session.hubUserId,
      "X-Hub-Session-Token": session.hubSessionToken,
      "X-Hub-Refresh-Token": session.hubRefreshToken,
    };
  }

  async request(functionName, body = {}, { authenticated = true, method = "POST" } = {}) {
    const headers = {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.session?.supabaseAccessToken || this.anonKey}`,
      "Content-Type": "application/json",
      "x-client-info": "mbeukimmig-hub-gate",
      ...(authenticated ? this.sessionHeaders() : {}),
    };
    const url = `${this.functionsUrl}/${functionName}`;
    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        mode: "cors",
        headers,
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      if (functionName === "hub-auth-register" || functionName === "hub-auth-login") {
        await new Promise((r) => setTimeout(r, 600));
        try {
          response = await this.fetchImpl(url, {
            method,
            mode: "cors",
            headers,
            ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
          });
        } catch (retryErr) {
          throw new HubGateError(
            `${NETWORK_ERROR_MESSAGE} (Edge: ${functionName})`,
            "NETWORK_ERROR",
            0,
            retryErr,
          );
        }
      } else {
        throw new HubGateError(
          `${NETWORK_ERROR_MESSAGE} (Edge: ${functionName})`,
          "NETWORK_ERROR",
          0,
          error,
        );
      }
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new HubGateError(
        payload.error || payload.message || "Le Hub Central ne répond pas.",
        payload.code || `HTTP_${response.status}`,
        response.status,
        payload,
      );
    }
    return payload;
  }

  async login(credentials, device) {
    const payload = await this.request(
      "hub-auth-login",
      { ...credentials, device_identifier: device.device_identifier },
      { authenticated: false },
    );
    this.saveSession(payload);
    return payload;
  }

  async register(account, device) {
    const payload = await this.request(
      "hub-auth-register",
      { ...account, device_identifier: device.device_identifier },
      { authenticated: false },
    );
    this.saveSession(payload);
    return payload;
  }

  forgotPassword(email) {
    return this.request("hub-auth-forgot-password", { email }, { authenticated: false });
  }

  async logout() {
    try {
      if (this.session) await this.request("hub-auth-logout");
    } catch {
      // Nettoyage local même si le Hub est injoignable.
    }
    this.clearSession();
    return { ok: true, logged_out: true };
  }

  me() {
    return this.request("hub-me");
  }

  licenseStatus(device) {
    return this.request("hub-license-status", {
      device_identifier: device.device_identifier,
    });
  }

  startTrial(device) {
    return this.request("validate-trial", device);
  }

  validatePromo(promoCode) {
    return this.request("hub-validate-promo", { promo_code: promoCode });
  }

  checkout({ promoCode, linkRef } = {}) {
    return this.request("hub-checkout", {
      promo_code: promoCode || undefined,
      link_ref: linkRef || undefined,
    });
  }

  syncLicense(device) {
    return this.request("hub-sync-license", {
      device_identifier: device.device_identifier,
    });
  }
}
