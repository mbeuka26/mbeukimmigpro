"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  HubErrorCodes: () => HubErrorCodes,
  MbeukHub: () => MbeukHub,
  MbeukHubError: () => MbeukHubError,
  SDK_VERSION: () => SDK_VERSION,
  assertHubEnv: () => assertHubEnv,
  createMbeukHub: () => createMbeukHub,
  extractRefFromUrl: () => extractRefFromUrl,
  resolveAffiliateAttribution: () => resolveAffiliateAttribution
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var MbeukHubError = class extends Error {
  constructor(message, opts) {
    super(message);
    this.name = "MbeukHubError";
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
  }
};

// src/version.ts
var SDK_VERSION = "2.0.0";

// src/http.ts
function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}
var HttpClient = class {
  constructor(config) {
    if (!config.baseUrl?.trim()) {
      throw new MbeukHubError("baseUrl est requis.", {
        code: "INVALID_CONFIG",
        status: 0
      });
    }
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.apiKey = config.apiKey;
    this.bearerToken = config.bearerToken;
    this.productId = config.productId?.trim() || void 0;
    this.applicationId = config.applicationId?.trim() || void 0;
    this.environment = config.environment;
    this.timeoutMs = config.timeoutMs ?? 3e4;
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
  }
  setBearerToken(token) {
    this.bearerToken = token;
  }
  setApiKey(key) {
    this.apiKey = key;
  }
  hasAuth() {
    return Boolean(this.apiKey || this.bearerToken);
  }
  resolveProductId(explicit) {
    const id = (explicit || this.productId || "").trim();
    return id || void 0;
  }
  headers(extra) {
    const h = new Headers(extra);
    h.set("Accept", "application/json");
    h.set("X-Mbeuk-SDK-Version", SDK_VERSION);
    if (this.environment) h.set("X-Mbeuk-Environment", this.environment);
    if (this.applicationId) h.set("X-Mbeuk-Application-Id", this.applicationId);
    if (this.productId) h.set("X-Mbeuk-Product-Id", this.productId);
    if (this.apiKey) h.set("X-API-Key", this.apiKey);
    if (this.bearerToken) h.set("Authorization", `Bearer ${this.bearerToken}`);
    return h;
  }
  async request(method, path, opts) {
    if (!opts?.public && !this.hasAuth()) {
      throw new MbeukHubError(
        "Fournissez apiKey (SaaS) ou bearerToken (admin/partner).",
        { code: "INVALID_CONFIG", status: 0 }
      );
    }
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    if (opts?.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== void 0 && v !== "") url.searchParams.set(k, v);
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = this.headers();
      let body;
      if (opts?.body !== void 0) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(opts.body);
      }
      const res = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.success === false) {
        const err = json && "error" in json ? json.error : null;
        throw new MbeukHubError(
          err?.message || `Erreur Hub HTTP ${res.status}`,
          {
            code: err?.code || "HTTP_ERROR",
            status: res.status,
            details: err?.details ?? json
          }
        );
      }
      return { data: json.data, meta: json.meta };
    } catch (e) {
      if (e instanceof MbeukHubError) throw e;
      if (e instanceof Error && e.name === "AbortError") {
        throw new MbeukHubError("D\xE9lai d'attente d\xE9pass\xE9.", {
          code: "TIMEOUT",
          status: 0
        });
      }
      throw new MbeukHubError(
        e instanceof Error ? e.message : "Erreur r\xE9seau.",
        { code: "NETWORK_ERROR", status: 0 }
      );
    } finally {
      clearTimeout(timer);
    }
  }
  get(path, query, opts) {
    return this.request("GET", path, { query, public: opts?.public });
  }
  post(path, body) {
    return this.request("POST", path, { body });
  }
  put(path, body) {
    return this.request("PUT", path, { body });
  }
  patch(path, body) {
    return this.request("PATCH", path, { body });
  }
  delete(path) {
    return this.request("DELETE", path);
  }
};

// src/resources/products.ts
var ProductsResource = class {
  constructor(http) {
    this.http = http;
  }
  async list(opts) {
    const { data, meta } = await this.http.get(
      "/products",
      {
        saas_app_id: opts?.saasAppId,
        active: opts?.active === false ? "false" : void 0
      }
    );
    return { products: data.products, meta };
  }
  async get(id) {
    const { data } = await this.http.get(
      `/products/${id}`
    );
    return data.product;
  }
  async create(input) {
    const { data } = await this.http.post(
      "/products",
      input
    );
    return data.product;
  }
  async update(id, patch) {
    const { data } = await this.http.patch(
      `/products/${id}`,
      patch
    );
    return data.product;
  }
  /** Soft-delete (is_active = false) */
  async remove(id) {
    const { data } = await this.http.delete(`/products/${id}`);
    return data;
  }
};

// src/resources/licenses.ts
var LicensesResource = class {
  constructor(http) {
    this.http = http;
  }
  async list(opts) {
    const { data, meta } = await this.http.get(
      "/licenses",
      {
        email: opts?.email,
        product_id: opts?.productId ?? this.http.productId,
        limit: opts?.limit != null ? String(opts.limit) : void 0
      }
    );
    return { licenses: data.licenses, meta };
  }
  /**
   * @deprecated Création manuelle de licence **payante** réservée aux admins Hub.
   * Une clé SaaS reçoit `PAID_LICENSE_FORBIDDEN`.
   * Utilisez `checkout.create` (paiement) ou `startTrial` / `auth.register({ start_trial })`.
   */
  async create(input) {
    const { data } = await this.http.post(
      "/licenses",
      input
    );
    return data.license;
  }
  /** Vérifie si une licence est valide (appel principal des SaaS). */
  async verify(input) {
    const product_id = this.http.resolveProductId(input.product_id);
    if (!product_id) {
      throw new MbeukHubError(
        "product_id requis (argument ou config.productId).",
        { code: "INVALID_CONFIG", status: 0 }
      );
    }
    const { data } = await this.http.post(
      "/licenses/verify",
      {
        email: input.email,
        product_id,
        device_identifier: input.device_identifier
      }
    );
    return data;
  }
  /**
   * Alias documenté de `verify` — contrôle d'accès serveur.
   * Ne jamais faire confiance au résultat côté navigateur seul.
   */
  async validateLicense(input) {
    return this.verify(input);
  }
  async activate(input) {
    const { data } = await this.http.post("/licenses/activate", input);
    return data;
  }
  /**
   * Démarre un essai (compte Hub déjà créé pour ce product_id).
   * Préférez `auth.register({ start_trial: true, device_identifier })`.
   */
  async startTrial(input) {
    const product_id = this.http.resolveProductId(input.product_id);
    if (!product_id) {
      throw new MbeukHubError(
        "product_id requis (argument ou config.productId).",
        { code: "INVALID_CONFIG", status: 0 }
      );
    }
    const body = {
      ...input,
      product_id,
      customer_email: input.customer_email || input.email,
      device_id: input.device_id || input.device_identifier
    };
    const { data } = await this.http.post("/licenses/trial", body);
    return data;
  }
  /**
   * Relit l'état licence après paiement (webhook Hub) — ne crée PAS de licence paid.
   * Accepte `email` ou `customer_email` ; `device_identifier` ou `device_id`.
   */
  async sync(input) {
    const product_id = this.http.resolveProductId(
      typeof input.product_id === "string" ? input.product_id : void 0
    );
    const email = typeof input.customer_email === "string" ? input.customer_email : typeof input.email === "string" ? input.email : void 0;
    const device_id = typeof input.device_id === "string" ? input.device_id : typeof input.device_identifier === "string" ? input.device_identifier : void 0;
    const { data } = await this.http.post("/licenses/sync", {
      ...input,
      product_id: product_id ?? input.product_id,
      ...email ? { customer_email: email, email } : {},
      ...device_id ? { device_id, device_identifier: device_id } : {}
    });
    return data;
  }
};

// src/resources/influencers.ts
var InfluencersResource = class {
  constructor(http) {
    this.http = http;
  }
  async list() {
    const { data, meta } = await this.http.get(
      "/influencers"
    );
    return { influencers: data.influencers, meta };
  }
  async get(id) {
    const { data } = await this.http.get(
      `/influencers/${id}`
    );
    return data.influencer;
  }
  /**
   * Crée un ambassadeur + compte Auth.
   * Retourne aussi temporary_password (à communiquer une seule fois).
   */
  async create(input) {
    const { data } = await this.http.post("/influencers", input);
    return data;
  }
  async update(id, patch) {
    const { data } = await this.http.patch(
      `/influencers/${id}`,
      patch
    );
    return data.influencer;
  }
  /** Soft-delete (is_active = false) */
  async remove(id) {
    const { data } = await this.http.delete(`/influencers/${id}`);
    return data;
  }
  async validatePromo(promo_code) {
    const { data } = await this.http.post("/affiliate/validate", { promo_code: promo_code.trim() });
    return data;
  }
  /**
   * Construit l'URL d'affiliation storefront à partir du code promo.
   * @example hub.influencers.buildAffiliateUrl('https://shop.example.com', 'AMB4F2A')
   */
  buildAffiliateUrl(storefrontBaseUrl, promoCode) {
    const base = storefrontBaseUrl.replace(/\/+$/, "");
    const code = encodeURIComponent(promoCode.trim());
    return `${base}?ref=${code}`;
  }
};

// src/affiliate.ts
function resolveAffiliateAttribution(opts) {
  const manual = typeof opts.manualCode === "string" ? opts.manualCode.trim() : "";
  if (manual) return manual;
  const link = typeof opts.linkRef === "string" ? opts.linkRef.trim() : "";
  return link || void 0;
}
function extractRefFromUrl(url) {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    const ref = u.searchParams.get("ref") || u.searchParams.get("affiliate");
    return ref?.trim() || void 0;
  } catch {
    return void 0;
  }
}

// src/resources/checkout.ts
var CheckoutResource = class {
  constructor(http) {
    this.http = http;
  }
  /**
   * Initie un checkout Chariow via le Hub (prix & merchant résolus SERVEUR).
   * Ne jamais activer une licence sur la seule page /success — attendre le webhook Hub.
   */
  async create(input) {
    const product_id = this.http.resolveProductId(input.product_id);
    if (!product_id) {
      throw new MbeukHubError(
        "product_id requis (argument ou config.productId).",
        { code: "INVALID_CONFIG", status: 0 }
      );
    }
    const customer_email = input.customer_email || input.email;
    if (!customer_email?.trim()) {
      throw new MbeukHubError("customer_email (ou email) requis.", {
        code: "INVALID_CONFIG",
        status: 0
      });
    }
    const affiliate_slug = resolveAffiliateAttribution({
      manualCode: input.promo_code || input.affiliate_slug,
      linkRef: input.ref || input.link_ref
    });
    const body = {
      product_id,
      customer_email: customer_email.trim(),
      affiliate_slug
    };
    const { data } = await this.http.post("/checkout", body);
    return data;
  }
};

// src/resources/saas-apps.ts
var SaasAppsResource = class {
  constructor(http) {
    this.http = http;
  }
  async list() {
    const { data } = await this.http.get("/saas-apps");
    return data.saas_apps;
  }
};

// src/resources/api-keys.ts
var ApiKeysResource = class {
  constructor(http) {
    this.http = http;
  }
  async list() {
    const { data } = await this.http.get(
      "/admin/api-keys"
    );
    return data.api_keys;
  }
  async create(input) {
    const { data } = await this.http.post(
      "/admin/api-keys",
      input
    );
    return data;
  }
  async revoke(id) {
    const { data } = await this.http.delete(`/admin/api-keys/${id}`);
    return data;
  }
};

// src/resources/cloud.ts
var CloudResource = class {
  constructor(http) {
    this.http = http;
  }
  /**
   * Résout le Cloud actif pour le SaaS (appel au démarrage).
   * Renvoie mode, URL, anon key et paramètres.
   */
  async getCloud(opts) {
    const query = {
      tenant_id: opts?.tenantId,
      product_id: opts?.productId,
      organization_id: opts?.organizationId,
      saas_app_id: opts?.saasAppId,
      id: opts?.id
    };
    if (!opts?.id) {
      query.resolve = "1";
    }
    const { data } = await this.http.get("/cloud", query);
    if ("cloud" in data) return data.cloud;
    return data.clouds?.[0] ?? null;
  }
  async list(filters) {
    const { data } = await this.http.get(
      "/cloud",
      filters
    );
    return data.clouds;
  }
  async createCloud(input) {
    const { data } = await this.http.post(
      "/cloud",
      input
    );
    return data.cloud;
  }
  async updateCloud(input) {
    const { data } = await this.http.put(
      "/cloud",
      input
    );
    return data.cloud;
  }
  async deleteCloud(id) {
    const { data } = await this.http.delete(
      `/cloud/${id}`
    );
    return data.deleted;
  }
  async testConnection(input) {
    const { data } = await this.http.post(
      "/cloud/test",
      input
    );
    return data.test;
  }
  async getUsage(cloudInstanceId) {
    const { data } = await this.http.get(
      "/cloud/usage",
      { cloud_instance_id: cloudInstanceId }
    );
    return data.usage;
  }
  async getLogs(cloudInstanceId, limit) {
    const { data } = await this.http.get("/cloud/logs", {
      cloud_instance_id: cloudInstanceId,
      limit: limit != null ? String(limit) : void 0
    });
    return data.logs;
  }
  async getBackups(cloudInstanceId) {
    const { data } = await this.http.get(
      "/cloud/backups",
      { cloud_instance_id: cloudInstanceId }
    );
    return data.backups;
  }
};

// src/resources/auth.ts
var AuthResource = class {
  constructor(http) {
    this.http = http;
  }
  /**
   * Crée un compte email+mdp pour un produit.
   * Optionnel : `start_trial: true` + `device_identifier` pour démarrer l'essai immédiatement.
   */
  async register(input) {
    const { data } = await this.http.post(
      "/auth/register",
      input
    );
    return data;
  }
  async login(input) {
    const { data } = await this.http.post("/auth/login", input);
    return data;
  }
  async refreshSession(input) {
    const { data } = await this.http.post(
      "/auth/refresh",
      input
    );
    return data;
  }
  /**
   * Mot de passe oublié : génère un nouveau MDP et l'envoie par email (Brevo).
   * Fournissez `brevo` si le Hub n'a pas HUB_BREVO_* en env.
   */
  async forgotPassword(input) {
    const { data } = await this.http.post("/auth/password-reset-request", input);
    return data;
  }
  /** @deprecated Préférez forgotPassword (MDP auto envoyé par email). */
  async requestPasswordReset(input) {
    return this.forgotPassword(input);
  }
  async resetPassword(input) {
    const { data } = await this.http.post(
      "/auth/password-reset",
      input
    );
    return data;
  }
  async logout(input) {
    const { data } = await this.http.post(
      "/auth/logout",
      input
    );
    return data;
  }
  async revokeDevice(input) {
    const { data } = await this.http.post(
      "/auth/devices/revoke",
      input
    );
    return data;
  }
};

// src/client.ts
var MbeukHub = class {
  constructor(config) {
    this.version = SDK_VERSION;
    this.config = { ...config };
    this.http = new HttpClient(config);
    this.products = new ProductsResource(this.http);
    this.licenses = new LicensesResource(this.http);
    this.influencers = new InfluencersResource(this.http);
    this.checkout = new CheckoutResource(this.http);
    this.saasApps = new SaasAppsResource(this.http);
    this.apiKeys = new ApiKeysResource(this.http);
    this.cloud = new CloudResource(this.http);
    this.auth = new AuthResource(this.http);
  }
  /** productId configuré (UUID Hub) */
  get productId() {
    return this.http.productId;
  }
  /** applicationId / saas_app_id Hub */
  get applicationId() {
    return this.http.applicationId;
  }
  get environment() {
    return this.http.environment;
  }
  /** Snapshot de config (sans secret apiKey) */
  getPublicConfig() {
    return {
      baseUrl: this.config.baseUrl,
      productId: this.http.productId,
      applicationId: this.http.applicationId,
      developerRef: this.config.developerRef,
      environment: this.http.environment,
      sdkVersion: this.version,
      hasApiKey: Boolean(this.config.apiKey)
    };
  }
  setBearerToken(token) {
    this.http.setBearerToken(token);
  }
  setApiKey(key) {
    this.http.setApiKey(key);
  }
  async health() {
    const { data } = await this.http.get("/health", void 0, { public: true });
    return data;
  }
};
/** Version du package SDK */
MbeukHub.version = SDK_VERSION;
function createMbeukHub(config) {
  return new MbeukHub(config);
}
function assertHubEnv(env) {
  const missing = [];
  if (!env.MBEUK_HUB_URL?.trim()) missing.push("MBEUK_HUB_URL");
  if (!env.MBEUK_HUB_API_KEY?.trim()) missing.push("MBEUK_HUB_API_KEY");
  if (!env.MBEUK_PRODUCT_ID?.trim()) missing.push("MBEUK_PRODUCT_ID");
  if (missing.length) {
    throw new MbeukHubError(
      `Configuration Hub manquante : ${missing.join(", ")}`,
      { code: "HUB_ENV_MISSING", status: 0 }
    );
  }
}

// src/error-codes.ts
var HubErrorCodes = {
  INVALID_CONFIG: "INVALID_CONFIG",
  INVALID_API_KEY: "INVALID_API_KEY",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN_SCOPE: "FORBIDDEN_SCOPE",
  TENANT_BINDING_REQUIRED: "TENANT_BINDING_REQUIRED",
  TENANT_MISMATCH: "TENANT_MISMATCH",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  LICENSE_NOT_FOUND: "LICENSE_NOT_FOUND",
  LICENSE_EXPIRED: "LICENSE_EXPIRED",
  LICENSE_INACTIVE: "LICENSE_INACTIVE",
  DEVICE_LIMIT_REACHED: "DEVICE_LIMIT_REACHED",
  PAID_LICENSE_FORBIDDEN: "PAID_LICENSE_FORBIDDEN",
  ACCOUNT_REQUIRED: "ACCOUNT_REQUIRED",
  EMAIL_ALREADY_LICENSED: "EMAIL_ALREADY_LICENSED",
  TRIAL_DISABLED: "TRIAL_DISABLED",
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  CHECKOUT_FAILED: "CHECKOUT_FAILED",
  TIMEOUT: "TIMEOUT",
  NETWORK_ERROR: "NETWORK_ERROR",
  HTTP_ERROR: "HTTP_ERROR",
  HUB_ENV_MISSING: "HUB_ENV_MISSING"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HubErrorCodes,
  MbeukHub,
  MbeukHubError,
  SDK_VERSION,
  assertHubEnv,
  createMbeukHub,
  extractRefFromUrl,
  resolveAffiliateAttribution
});
