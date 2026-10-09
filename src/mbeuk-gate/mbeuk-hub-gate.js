import { HubGateClient, HubGateError } from "./hub-gate-client.js";
import { getDeviceIdentity } from "./device-fingerprint.js";
import {
  BUY_LICENSE_LABEL,
  NETWORK_ERROR_MESSAGE,
  NO_LICENSE_MESSAGE,
  TRIAL_LABEL,
  accessGrantedFromPaymentReturn,
  isNetworkError,
  isPaymentAbortValue,
} from "./gate-messages.js";

export {
  BUY_LICENSE_LABEL,
  NETWORK_ERROR_MESSAGE,
  NO_LICENSE_MESSAGE,
  TRIAL_LABEL,
  accessGrantedFromPaymentReturn,
  isNetworkError,
};

const REF_KEY = "mbeuk_hub_affiliate_ref";
const PROMO_KEY = "mbeuk_hub_manual_promo";
const RENEW_RE = /renouvel(er|lement).{0,12}licence|renew.{0,12}licen[cs]e/i;

const PAGE_ROUTES = {
  auth: "./auth.html",
  chooseAccess: "./choose-access.html",
  promo: "./promo.html",
  app: "./platform.html",
};

function currentPageName() {
  try {
    const path = globalThis.location?.pathname || "";
    return path.split("/").pop() || "index.html";
  } catch {
    return "index.html";
  }
}

function isAuthEntryPage() {
  const p = currentPageName();
  return p === "auth.html" || p === "index.html" || p === "access.html";
}

function isAccessFlowPage() {
  const p = currentPageName();
  return p === "choose-access.html" || p === "promo.html";
}

function isAppPage() {
  return currentPageName() === "platform.html";
}

export const GateStatus = Object.freeze({
  CHECKING: "checking",
  ANONYMOUS: "anonymous",
  TRIAL: "trial",
  STANDARD: "standard",
  BLOCKED: "blocked",
  ERROR: "error",
});

export function normalizeEntitlement(payload, now = new Date()) {
  const subscription = payload?.subscription || payload?.license || {};
  const rawStatus = String(subscription.status || payload?.status || "").toLowerCase();
  const plan = String(subscription.plan || payload?.plan || "").toLowerCase();
  const valid = payload?.valid === true;
  const trialEnd = subscription.trial_ends_at || payload?.trial_ends_at || null;
  const expiration = trialEnd || subscription.expires_at || payload?.expiration_date || null;
  const endDate = expiration ? new Date(expiration) : null;
  const daysRemaining = endDate && !Number.isNaN(endDate.getTime())
    ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000))
    : null;
  const isTrial = rawStatus === "trial" || plan === "trial";
  const unpaid = /unpaid|none|pending|cancel|fail|abandon|expired|blocked/.test(rawStatus)
    || /unpaid|cancel|fail|abandon/.test(String(payload?.payment_status || "").toLowerCase());

  if (valid && isTrial) {
    return { status: GateStatus.TRIAL, label: "Essai gratuit", daysRemaining, expiration };
  }
  if (valid && !isTrial && !unpaid) {
    return { status: GateStatus.STANDARD, label: "Standard", daysRemaining: null, expiration };
  }
  return {
    status: GateStatus.BLOCKED,
    label: rawStatus === "expired" ? "Accès expiré" : "Accès requis",
    daysRemaining,
    expiration,
    reason: unpaid ? (payload?.reason || "UNPAID") : (payload?.reason || rawStatus || "NO_ENTITLEMENT"),
  };
}

export function authFeedback(error) {
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  const code = error?.code || "";
  if (code === "INVALID_EMAIL") {
    return "Email invalide. Saisissez correctement votre email puis reconnectez-vous.";
  }
  if (code === "ACCOUNT_NOT_FOUND") return "Vérifiez votre email et mot de passe.";
  if (code === "WRONG_PASSWORD") return "Vérifiez votre mot de passe.";
  if (code === "INVALID_CREDENTIALS") return "Identifiant invalide. Vérifiez votre mot de passe.";
  if (code === "DEVICE_LIMIT_REACHED") return "Quota d’appareils atteint. Contactez le support.";
  if (code === "INVALID_PROMO") return "Code promo invalide. Vérifiez le code et réessayez.";
  return error?.message || NETWORK_ERROR_MESSAGE;
}

export function pickField(values, aliases) {
  const entries = Object.entries(values || {});
  for (const alias of aliases) {
    const direct = values?.[alias];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const found = entries.find(([key]) => key.toLowerCase() === alias.toLowerCase());
    if (found && String(found[1] || "").trim()) return String(found[1]).trim();
  }
  return "";
}

export function credentialsFromForm(values) {
  return {
    email: pickField(values, ["email", "identifiant", "username", "user_email", "mail"]),
    password: pickField(values, ["password", "mot_de_passe", "mdp", "pass"]),
    full_name: pickField(values, ["full_name", "fullname", "name", "nom", "nom_complet"]),
    phone: pickField(values, ["phone", "telephone", "tel", "whatsapp"]),
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function node(tag, attributes = {}, text = "") {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === "className") element.className = value;
    else if (name.startsWith("on") && typeof value === "function") {
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else element.setAttribute(name, value);
  }
  if (text) element.textContent = text;
  return element;
}

export function hideObsoleteRenewActions(root = document) {
  const hidden = [];
  const candidates = root.querySelectorAll?.("a, button, [data-mbeuk-renew]") || [];
  for (const element of candidates) {
    const labeled = `${element.getAttribute("data-mbeuk-renew") || ""} ${element.textContent || ""}`;
    if (!RENEW_RE.test(labeled) && element.getAttribute("data-mbeuk-renew") !== "true") continue;
    element.hidden = true;
    element.setAttribute("aria-hidden", "true");
    if ("disabled" in element) element.disabled = true;
    hidden.push(element);
  }
  return hidden;
}

export class MbeukHubGate extends EventTarget {
  constructor(config) {
    super();
    this.config = {
      protectedRoot: "#app",
      headerTarget: null,
      authMode: "existing",
      paymentReturnParam: "payment",
      paymentReturnValue: "success",
      sector: "generic",
      hideRenewLicense: true,
      productDescription: "",
      pageRouting: false,
      ...config,
    };
    this.client = config.client || new HubGateClient(config);
    this.device = null;
    this.profile = null;
    this.entitlement = null;
    this.status = GateStatus.CHECKING;
    this.overlay = null;
    this.awaitingWebhook = false;
    this.captureAffiliateRef();
    if (this.config.hideRenewLicense && typeof document !== "undefined") {
      hideObsoleteRenewActions(document);
    }
  }

  captureAffiliateRef() {
    try {
      const ref = new URLSearchParams(globalThis.location?.search || "").get("ref");
      if (ref) sessionStorage.setItem(REF_KEY, ref.trim());
      return ref;
    } catch {
      return null;
    }
  }

  setState(status, detail = {}) {
    this.status = status;
    Object.assign(this, detail);
    this.applyProtection();
    this.renderBadge();
    this.dispatchEvent(new CustomEvent("statechange", {
      detail: { status, profile: this.profile, entitlement: this.entitlement, ...detail },
    }));
    if ([GateStatus.TRIAL, GateStatus.STANDARD].includes(status)) {
      this.overlay?.remove();
      this.overlay = null;
      if (this.config.pageRouting) this.maybeRedirectForPageRouting(status);
    } else if (status === GateStatus.BLOCKED && !this.config.pageRouting) {
      queueMicrotask(() => this.mountAccessBarrier());
    } else if (status === GateStatus.ANONYMOUS && this.config.pageRouting) {
      this.maybeRedirectForPageRouting(status);
    } else if (status === GateStatus.BLOCKED && this.config.pageRouting) {
      this.maybeRedirectForPageRouting(status);
    }
  }

  maybeRedirectForPageRouting(status) {
    if (!this.config.pageRouting || status === GateStatus.CHECKING) return;
    const allowed = [GateStatus.TRIAL, GateStatus.STANDARD].includes(status);
    const hasSession = Boolean(this.client.session);

    if (isAuthEntryPage()) {
      if (allowed) {
        globalThis.location.replace(PAGE_ROUTES.app);
      }
      return;
    }

    if (isAccessFlowPage()) {
      if (!hasSession) {
        globalThis.location.replace(PAGE_ROUTES.auth);
        return;
      }
      if (allowed) {
        globalThis.location.replace(PAGE_ROUTES.app);
      }
      return;
    }

    if (isAppPage()) {
      if (!hasSession && status === GateStatus.ANONYMOUS) {
        globalThis.location.replace(PAGE_ROUTES.auth);
        return;
      }
      if (!allowed && status === GateStatus.BLOCKED) {
        globalThis.location.replace(PAGE_ROUTES.chooseAccess);
      }
    }
  }

  applyProtection() {
    const root = document.querySelector(this.config.protectedRoot);
    const allowed = [GateStatus.TRIAL, GateStatus.STANDARD].includes(this.status);
    if (!root) return;
    if (this.config.pageRouting && !isAppPage()) {
      root.hidden = false;
      if ("inert" in root) root.inert = false;
      root.setAttribute("aria-hidden", "false");
      return;
    }
    root.hidden = !allowed;
    if ("inert" in root) root.inert = !allowed;
    root.setAttribute("aria-hidden", String(!allowed));
  }

  async boot() {
    this.setState(GateStatus.CHECKING);
    this.device = await getDeviceIdentity();
    if (this.config.hideRenewLicense) hideObsoleteRenewActions(document);
    if (!this.client.session) {
      this.setState(GateStatus.ANONYMOUS);
      if (this.config.authMode === "universal") this.mountUniversalAuth();
      return this.snapshot();
    }

    try {
      await this.refresh();
      if (this.isPaymentAbort()) {
        this.clearPaymentQuery();
        this.setState(GateStatus.BLOCKED, {
          entitlement: {
            status: GateStatus.BLOCKED,
            label: "Accès requis",
            reason: "UNPAID",
          },
        });
      } else if (this.isPaymentReturn()) {
        this.clearPaymentQuery();
        void accessGrantedFromPaymentReturn();
        await this.pollPayment();
      }
    } catch (error) {
      if (error instanceof HubGateError && error.status === 401) {
        this.client.clearSession();
        this.setState(GateStatus.ANONYMOUS, { error: null });
        if (this.config.authMode === "universal") this.mountUniversalAuth();
      } else {
        this.setState(GateStatus.ERROR, { error });
        this.mountNetworkBarrier(error);
      }
    }
    return this.snapshot();
  }

  async refresh() {
    const [me, license] = await Promise.all([
      this.client.me(),
      this.client.licenseStatus(this.device),
    ]);
    this.profile = me.profile || {
      full_name: this.client.session?.fullName,
      email: this.client.session?.email,
    };
    this.entitlement = normalizeEntitlement(license);
    this.setState(this.entitlement.status);
    return this.snapshot();
  }

  async login(raw) {
    const { email, password } = credentialsFromForm(raw);
    if (!isValidEmail(email)) {
      throw new HubGateError(
        "Email invalide. Saisissez correctement votre email puis reconnectez-vous.",
        "INVALID_EMAIL",
        400,
      );
    }
    const result = await this.client.login({ email, password }, this.device);
    await this.refresh();
    return result;
  }

  async register(raw) {
    const { full_name, email, phone, password } = credentialsFromForm(raw);
    if (!String(full_name || "").trim()) {
      throw new HubGateError("Le nom est requis.", "NAME_REQUIRED", 400);
    }
    if (!isValidEmail(email)) {
      throw new HubGateError(
        "Email invalide. Saisissez correctement votre email puis reconnectez-vous.",
        "INVALID_EMAIL",
        400,
      );
    }
    const result = await this.client.register(
      { full_name, email, phone, password },
      this.device,
    );
    try {
      await this.refresh();
    } catch (error) {
      if (this.client.session) {
        this.setState(GateStatus.BLOCKED, {
          entitlement: {
            status: GateStatus.BLOCKED,
            label: "Accès requis",
            reason: "UNPAID",
          },
        });
        return result;
      }
      throw error;
    }
    return result;
  }

  async forgotPassword(raw) {
    const email = typeof raw === "string" ? raw : credentialsFromForm(raw).email;
    if (!isValidEmail(email)) {
      throw new HubGateError(
        "Email invalide. Saisissez correctement votre email puis reconnectez-vous.",
        "INVALID_EMAIL",
        400,
      );
    }
    return this.client.forgotPassword(email);
  }

  async logout() {
    await this.client.logout();
    this.profile = null;
    this.entitlement = null;
    this.setState(GateStatus.ANONYMOUS);
    if (this.config.authMode === "universal") this.mountUniversalAuth();
    return this.snapshot();
  }

  async startTrial() {
    await this.client.startTrial(this.device);
    return this.refresh();
  }

  async validatePromo(code) {
    const normalized = String(code || "").trim();
    if (!normalized) return { valid: false, message: "Code promo invalide. Vérifiez le code et réessayez." };
    const result = await this.client.validatePromo(normalized);
    if (result.valid) sessionStorage.setItem(PROMO_KEY, normalized);
    else sessionStorage.removeItem(PROMO_KEY);
    return result;
  }

  bindPromoInput(input, feedback) {
    if (!input) return;
    const message = typeof feedback === "function" ? feedback : () => {};
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const code = String(input.value || "").trim();
      if (!code) {
        sessionStorage.removeItem(PROMO_KEY);
        return;
      }
      timer = setTimeout(async () => {
        const result = await this.validatePromo(code).catch((error) => ({
          valid: false,
          message: error?.message,
        }));
        message({
          type: result.valid ? "success" : "error",
          text: result.valid
            ? `Réussi — vous effectuez vos paiements avec le code de « ${result.influencer_name || "votre influenceur"} ».`
            : (result.message || "Code promo invalide. Vérifiez le code et réessayez."),
          result,
        });
      }, 450);
    });
  }

  async beginCheckout({ promoCode } = {}) {
    const promo = String(promoCode || sessionStorage.getItem(PROMO_KEY) || "").trim();
    if (promo) {
      const validation = await this.validatePromo(promo);
      if (!validation.valid) {
        throw new HubGateError(
          validation.message || "Code promo invalide. Vérifiez le code et réessayez.",
          "INVALID_PROMO",
          400,
          validation,
        );
      }
    }
    const checkout = await this.client.checkout({
      promoCode: promo || undefined,
      linkRef: sessionStorage.getItem(REF_KEY) || undefined,
    });
    if (!checkout.checkout_url) {
      throw new HubGateError("URL de paiement absente.", "NO_CHECKOUT_URL", 502);
    }
    globalThis.location.assign(checkout.checkout_url);
    return checkout;
  }

  paymentQueryValue() {
    try {
      const params = new URLSearchParams(globalThis.location?.search || "");
      return params.get(this.config.paymentReturnParam) || params.get("status") || "";
    } catch {
      return "";
    }
  }

  isPaymentReturn() {
    return this.paymentQueryValue() === this.config.paymentReturnValue;
  }

  isPaymentAbort() {
    return isPaymentAbortValue(this.paymentQueryValue());
  }

  clearPaymentQuery() {
    try {
      const url = new URL(globalThis.location.href);
      url.searchParams.delete(this.config.paymentReturnParam);
      url.searchParams.delete("status");
      globalThis.history?.replaceState({}, "", url);
    } catch {
      // Navigation non disponible (tests).
    }
  }

  async pollPayment({ attempts = 8, delayMs = 2500 } = {}) {
    this.awaitingWebhook = true;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const sync = await this.client.syncLicense(this.device).catch((error) => {
        if (isNetworkError(error)) throw error;
        return null;
      });
      if (sync?.valid === true && sync?.payment_confirmed === true) {
        this.awaitingWebhook = false;
        return this.refresh();
      }
      if (sync?.valid === true) {
        this.awaitingWebhook = false;
        return this.refresh();
      }
      const status = await this.client.licenseStatus(this.device).catch((error) => {
        if (isNetworkError(error)) throw error;
        return null;
      });
      const entitlement = normalizeEntitlement(status);
      if ([GateStatus.TRIAL, GateStatus.STANDARD].includes(entitlement.status)) {
        this.awaitingWebhook = false;
        return this.refresh();
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    this.awaitingWebhook = false;
    this.setState(GateStatus.BLOCKED, {
      entitlement: {
        status: GateStatus.BLOCKED,
        label: "Accès requis",
        reason: "UNPAID",
      },
    });
    return this.snapshot();
  }

  bindExistingAuth({
    loginForm,
    registerForm,
    forgotForm,
    promoInput,
    buyButton,
    trialButton,
    logoutButton,
    feedback,
  } = {}) {
    const message = typeof feedback === "function" ? feedback : () => {};
    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(loginForm));
        try {
          message({ type: "loading", text: "Connexion…" });
          await this.login(values);
          if (this.status === GateStatus.BLOCKED) {
            if (this.config.pageRouting) {
              this.maybeRedirectForPageRouting(GateStatus.BLOCKED);
              return;
            }
            message({ type: "error", text: NO_LICENSE_MESSAGE });
            this.mountAccessBarrier();
            return;
          }
          message({ type: "success", text: "Connexion réussie." });
        } catch (error) {
          message({ type: "error", text: authFeedback(error), error });
        }
      });
    }
    if (registerForm) {
      registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(registerForm));
        try {
          message({ type: "loading", text: "Création du compte…" });
          await this.register(values);
          if (this.status === GateStatus.BLOCKED) {
            if (this.config.pageRouting && isAuthEntryPage()) {
              globalThis.location.replace(PAGE_ROUTES.chooseAccess);
              return;
            }
            if (this.config.pageRouting) {
              this.maybeRedirectForPageRouting(GateStatus.BLOCKED);
              return;
            }
            message({ type: "error", text: NO_LICENSE_MESSAGE });
            this.mountAccessBarrier();
            return;
          }
          message({ type: "success", text: "Compte créé. Redirection…" });
          if (this.config.pageRouting && isAuthEntryPage()) {
            globalThis.location.replace(PAGE_ROUTES.chooseAccess);
          }
        } catch (error) {
          message({ type: "error", text: authFeedback(error), error });
        }
      });
    }
    if (forgotForm) {
      forgotForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(forgotForm));
        try {
          message({ type: "loading", text: "Envoi du lien…" });
          await this.forgotPassword(values);
          message({ type: "success", text: "Si un compte existe, un email de réinitialisation a été envoyé." });
        } catch (error) {
          message({ type: "error", text: authFeedback(error), error });
        }
      });
    }
    this.bindPromoInput(promoInput, message);
    buyButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        message({ type: "loading", text: "Ouverture du paiement sécurisé…" });
        await this.beginCheckout({ promoCode: promoInput?.value });
      } catch (error) {
        message({ type: "error", text: authFeedback(error), error });
      }
    });
    trialButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        message({ type: "loading", text: "Activation de l’essai…" });
        await this.startTrial();
        message({ type: "success", text: "Essai gratuit activé." });
      } catch (error) {
        message({ type: "error", text: authFeedback(error) || "Cet essai n’est pas disponible.", error });
      }
    });
    logoutButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      await this.logout();
    });
    hideObsoleteRenewActions(document);
  }

  renderBadge() {
    if (!this.config.headerTarget) return;
    const target = document.querySelector(this.config.headerTarget);
    if (!target) return;
    target.replaceChildren();
    const name = this.profile?.full_name || this.profile?.email || "";
    if (name) target.append(node("span", { className: "mbeuk-gate__user" }, name));
    if (this.entitlement?.label) {
      const suffix = this.entitlement.daysRemaining != null
        ? ` · ${this.entitlement.daysRemaining} j`
        : "";
      target.append(node(
        "span",
        { className: `mbeuk-gate__badge mbeuk-gate__badge--${this.entitlement.status}` },
        `${this.entitlement.label}${suffix}`,
      ));
    }
  }

  overlayClass() {
    const sector = String(this.config.sector || "generic").toLowerCase();
    return `mbeuk-gate mbeuk-gate--dark mbeuk-gate--${sector}`;
  }

  productBlurb() {
    const custom = String(this.config.productDescription || "").trim();
    if (custom) return custom;
    const sector = String(this.config.sector || "generic").toLowerCase();
    if (sector === "mecanique" || sector === "mechanical") {
      return "Logiciel de génie mécanique et de simulation : structures, solides et fluides — conception, analyse et validation dans un seul espace de travail.";
    }
    return "Plateforme connectée au Hub Central : identifiez-vous, activez un essai ou une licence, puis accédez à votre métier.";
  }

  mechanicalScene() {
    const wrap = node("div", { className: "mbeuk-gate__scene", "aria-hidden": "true" });
    wrap.innerHTML = `
      <svg class="mbeuk-gate__mech" viewBox="0 0 640 360" fill="none">
        <g class="mbeuk-gate__grid">
          <path d="M40 40h560M40 100h560M40 160h560M40 220h560M40 280h560M40 340h560"/>
          <path d="M80 20v320M160 20v320M240 20v320M320 20v320M400 20v320M480 20v320M560 20v320"/>
        </g>
        <g class="mbeuk-gate__beam">
          <path d="M70 250h180l40-70h90"/>
          <circle cx="70" cy="250" r="6"/>
          <circle cx="290" cy="180" r="6"/>
        </g>
        <g class="mbeuk-gate__piston">
          <rect x="430" y="92" width="28" height="118" rx="4"/>
          <rect class="mbeuk-gate__rod" x="436" y="70" width="16" height="70" rx="2"/>
          <rect x="418" y="58" width="52" height="16" rx="3"/>
        </g>
        <g class="mbeuk-gate__gear mbeuk-gate__gear--lg" transform="translate(168 168)">
          <circle r="46" /><circle r="18"/>
          <path d="M0-58v16M0 42v16M58 0h-16M-42 0h-16M41-41l-11 11M-30 30l-11 11M41 41l-11-11M-30-30l-11-11"/>
        </g>
        <g class="mbeuk-gate__gear mbeuk-gate__gear--sm" transform="translate(248 118)">
          <circle r="26"/><circle r="10"/>
          <path d="M0-34v10M0 24v10M34 0h-10M-24 0h-10"/>
        </g>
        <g class="mbeuk-gate__fluid">
          <path d="M500 300c18-22 38-22 56 0s38 22 56 0"/>
          <circle class="mbeuk-gate__drop" cx="518" cy="268" r="4"/>
          <circle class="mbeuk-gate__drop mbeuk-gate__drop--b" cx="552" cy="252" r="3"/>
        </g>
      </svg>`;
    return wrap;
  }

  mountUniversalAuth(target = document.body) {
    if (this.overlay?.isConnected) return;
    const overlay = node("section", {
      className: this.overlayClass(),
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "mbeuk-gate-title",
    });
    const card = node("div", { className: "mbeuk-gate__card" });
    const title = node("h1", { id: "mbeuk-gate-title" }, "Accédez à votre espace");
    const intro = node("p", { className: "mbeuk-gate__intro" }, this.productBlurb());
    const feedback = node("p", { className: "mbeuk-gate__feedback", "aria-live": "polite" });
    const form = node("form", { className: "mbeuk-gate__form" });
    const switchMode = node("button", { type: "button", className: "mbeuk-gate__secondary" });
    const forgotLink = node("button", { type: "button", className: "mbeuk-gate__secondary" }, "Mot de passe oublié");
    let mode = "login";
    const renderForm = () => {
      form.replaceChildren();
      if (mode === "register") {
        form.append(
          this.input("full_name", "Nom complet", "text", true),
          this.input("phone", "Téléphone", "tel", false),
        );
      }
      form.append(
        this.input("email", "Email", "email", true),
        ...(mode === "forgot" ? [] : [this.input("password", "Mot de passe", "password", true)]),
        node(
          "button",
          { type: "submit", className: "mbeuk-gate__primary" },
          mode === "login" ? "Se connecter" : mode === "register" ? "Créer mon compte" : "Envoyer le lien",
        ),
      );
      title.textContent = mode === "login"
        ? "Accédez à votre espace"
        : mode === "register" ? "Créez votre compte" : "Mot de passe oublié";
      intro.textContent = mode === "forgot"
        ? "Saisissez votre email pour recevoir un nouveau mot de passe."
        : this.productBlurb();
      switchMode.textContent = mode === "login"
        ? "Nouveau ? Créer un compte"
        : "Déjà inscrit ? Se connecter";
      forgotLink.hidden = mode !== "login";
    };
    switchMode.addEventListener("click", () => {
      mode = mode === "login" ? "register" : "login";
      feedback.textContent = "";
      renderForm();
    });
    forgotLink.addEventListener("click", () => {
      mode = "forgot";
      feedback.textContent = "";
      renderForm();
    });
    renderForm();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      feedback.className = "mbeuk-gate__feedback";
      feedback.textContent = mode === "login" ? "Connexion…" : mode === "register" ? "Création du compte…" : "Envoi…";
      try {
        if (mode === "login") await this.login(values);
        else if (mode === "register") await this.register(values);
        else {
          await this.forgotPassword(values);
          feedback.className = "mbeuk-gate__feedback mbeuk-gate__feedback--success";
          feedback.textContent = "Si un compte existe, un email a été envoyé.";
          return;
        }
        if (this.status === GateStatus.BLOCKED) {
          this.mountAccessBarrier();
          return;
        }
        feedback.className = "mbeuk-gate__feedback mbeuk-gate__feedback--success";
        feedback.textContent = mode === "login" ? "Connexion réussie." : "Compte créé avec succès.";
        overlay.remove();
      } catch (error) {
        feedback.className = "mbeuk-gate__feedback mbeuk-gate__feedback--error";
        feedback.textContent = authFeedback(error);
      }
    });
    card.append(
      node("p", { className: "mbeuk-gate__eyebrow" }, this.config.productName || "Application SaaS"),
      title,
      intro,
      form,
      switchMode,
      forgotLink,
      feedback,
    );
    overlay.append(this.mechanicalScene(), card);
    target.append(overlay);
    this.overlay = overlay;
  }

  mountNetworkBarrier(error, target = document.body) {
    this.overlay?.remove();
    const overlay = node("section", {
      className: this.overlayClass(),
      role: "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": "mbeuk-network-title",
    });
    const card = node("div", { className: "mbeuk-gate__card" });
    card.append(
      node("p", { className: "mbeuk-gate__eyebrow" }, this.config.productName || "Application SaaS"),
      node("h1", { id: "mbeuk-network-title" }, "Connexion interrompue"),
      node("p", { className: "mbeuk-gate__intro mbeuk-gate__feedback--error" }, NETWORK_ERROR_MESSAGE),
    );
    overlay.append(this.mechanicalScene(), card);
    target.append(overlay);
    this.overlay = overlay;
    return error;
  }

  mountAccessBarrier(target = document.body) {
    this.overlay?.remove();
    const overlay = node("section", {
      className: this.overlayClass(),
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "mbeuk-access-title",
    });
    const card = node("div", { className: "mbeuk-gate__card" });
    const feedback = node("p", { className: "mbeuk-gate__feedback", "aria-live": "polite" });
    const promo = node("input", {
      name: "promo_code",
      type: "text",
      autocomplete: "off",
      placeholder: "Code ambassadeur (facultatif)",
      "aria-label": "Code ambassadeur",
    });
    this.bindPromoInput(promo, ({ type, text }) => {
      feedback.className = `mbeuk-gate__feedback mbeuk-gate__feedback--${type === "success" ? "success" : "error"}`;
      feedback.textContent = text;
    });
    const trialButton = node("button", { type: "button", className: "mbeuk-gate__secondary mbeuk-gate__cta" }, TRIAL_LABEL);
    trialButton.addEventListener("click", async () => {
      feedback.className = "mbeuk-gate__feedback";
      feedback.textContent = "Activation de l’essai…";
      try {
        await this.startTrial();
      } catch (error) {
        feedback.className = "mbeuk-gate__feedback mbeuk-gate__feedback--error";
        feedback.textContent = authFeedback(error);
      }
    });
    const buyButton = node("button", { type: "button", className: "mbeuk-gate__primary mbeuk-gate__cta" }, BUY_LICENSE_LABEL);
    buyButton.addEventListener("click", async () => {
      feedback.className = "mbeuk-gate__feedback";
      feedback.textContent = "Ouverture du paiement sécurisé…";
      try {
        await this.beginCheckout({ promoCode: promo.value });
      } catch (error) {
        feedback.className = "mbeuk-gate__feedback mbeuk-gate__feedback--error";
        feedback.textContent = authFeedback(error);
      }
    });
    const promoField = node("label", { className: "mbeuk-gate__field" });
    promoField.append(node("span", {}, "Code ambassadeur"), promo);
    const note = this.awaitingWebhook
      ? "Le paiement n’est confirmé que par le webhook Hub (PAYMENT_CONFIRMED). Une page de succès ne donne aucun accès."
      : "";
    card.append(
      node("p", { className: "mbeuk-gate__eyebrow" }, this.config.productName || "Application SaaS"),
      node("h1", { id: "mbeuk-access-title" }, "Licence requise"),
      node("p", { className: "mbeuk-gate__intro mbeuk-gate__alert" }, NO_LICENSE_MESSAGE),
      node("p", { className: "mbeuk-gate__intro" }, this.productBlurb()),
      promoField,
      buyButton,
      trialButton,
      ...(note ? [node("p", { className: "mbeuk-gate__note" }, note)] : []),
      feedback,
    );
    overlay.append(this.mechanicalScene(), card);
    target.append(overlay);
    this.overlay = overlay;
  }

  input(name, label, type, required) {
    const wrapper = node("label", { className: "mbeuk-gate__field" });
    wrapper.append(
      node("span", {}, label),
      node("input", { name, type, autocomplete: type === "password" ? "current-password" : name, ...(required ? { required: "" } : {}) }),
    );
    return wrapper;
  }

  snapshot() {
    return {
      status: this.status,
      profile: this.profile,
      entitlement: this.entitlement,
      authenticated: Boolean(this.client.session),
      allowed: [GateStatus.TRIAL, GateStatus.STANDARD].includes(this.status),
    };
  }
}

if (typeof window !== "undefined") {
  window.MbeukHubGate = MbeukHubGate;
  window.hideObsoleteRenewActions = hideObsoleteRenewActions;
}
