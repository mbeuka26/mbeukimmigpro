/** Version officielle du SDK — exposée sur `MbeukHub.version` et header HTTP. */
declare const SDK_VERSION: "2.0.0";
type SdkEnvironment = "development" | "staging" | "production";

type MbeukHubConfig = {
    /** URL de base du Hub, ex: https://hub.mbeukstore.com (sans /api/v1) */
    baseUrl: string;
    /**
     * Clé API SaaS secrète (`mbs_…`) — SERVEUR UNIQUEMENT.
     * Jamais `NEXT_PUBLIC_*`, jamais localStorage, jamais frontend.
     */
    apiKey?: string;
    /** JWT Supabase (admin ou ambassadeur) — serveur uniquement */
    bearerToken?: string;
    /**
     * UUID produit Hub (`products.id`) — recommandé.
     * Utilisé comme défaut pour verify / auth / checkout si non passé à l'appel.
     */
    productId?: string;
    /**
     * UUID application Hub (`saas_apps.id` = hub_saas_app_id Portal).
     * La clé API doit être liée à cette app (isolation multi-tenant).
     */
    applicationId?: string;
    /** Référence développeur Portal (informational / logs) */
    developerRef?: string;
    /** Environnement d'exécution */
    environment?: SdkEnvironment;
    /** Timeout fetch en ms (défaut 30000) */
    timeoutMs?: number;
    /** fetch custom (tests / edge) */
    fetch?: typeof fetch;
};
type Product = {
    id: string;
    name: string;
    chariow_product_id: string;
    type: string;
    price: number;
    is_active: boolean;
    is_trial_enabled?: boolean;
    trial_days?: number;
    saas_app_id?: string | null;
    billing_period?: string;
    duration_days?: number;
    features?: Record<string, boolean>;
    image_url?: string | null;
    description?: string | null;
    created_at?: string;
};
type License = {
    id: string;
    email: string;
    product_id: string;
    status?: string;
    access_type?: string;
    expiration_date?: string | null;
    device_identifier?: string | null;
    has_cloud_access?: boolean;
    features?: Record<string, boolean>;
    created_at?: string;
};
type LicenseVerifyResult = {
    valid: boolean;
    reason?: string;
    message?: string;
    status?: string;
    expiration_date?: string;
    max_devices?: number;
    devices?: Array<{
        id?: string;
        device_identifier: string;
        last_seen_at?: string;
        created_at?: string;
    }>;
    license?: License & {
        has_cloud_access?: boolean;
        features?: Record<string, boolean>;
        max_devices?: number;
    };
};
type AuthRegisterInput = {
    email: string;
    password: string;
    product_id: string;
    /** Si true, démarre l'essai (requiert device_identifier) */
    start_trial?: boolean;
    device_identifier?: string;
    device_id?: string;
};
type AuthRegisterResult = {
    user_id: string;
    email: string;
    product_id: string;
    trial_started?: boolean;
    trial_error?: {
        code: string;
        message: string;
    };
    trial?: {
        license_id: string;
        expires_at: string;
        trial_days: number;
        license_token: string;
        max_devices: number;
    };
};
type AuthLoginInput = {
    email: string;
    password: string;
    product_id: string;
    device_identifier?: string;
};
type AuthLoginResult = {
    authenticated: boolean;
    /** false si quota appareils atteint — ne pas ouvrir l'app */
    access_granted?: boolean;
    session_token: string;
    refresh_token: string;
    expires_at?: number;
    user_id: string;
    email: string;
    product_id: string;
    license: LicenseVerifyResult;
    device_status: "activated" | "already_active" | "device_limit_reached" | "skipped";
    devices?: Array<{
        id?: string;
        device_identifier: string;
        last_seen_at?: string;
        created_at?: string;
    }>;
    max_devices?: number;
};
type AuthRefreshResult = {
    session_token: string;
    refresh_token: string;
    expires_at?: number;
};
type Influencer = {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    country?: string | null;
    avatar_url?: string | null;
    cni_number?: string | null;
    commission_percentage: number;
    total_earnings?: number;
    promo_code?: string | null;
    bonus_days_offered?: number;
    is_active?: boolean;
    created_at?: string;
};
type SaasApp = {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    is_active: boolean;
    created_at?: string;
};
type ApiKeyRecord = {
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    is_active: boolean;
    saas_app_id?: string | null;
    last_used_at?: string | null;
    expires_at?: string | null;
    created_at?: string;
};
type CreateApiKeyResult = {
    api_key: ApiKeyRecord;
    secret: string;
    warning: string;
};
type CloudMode = "central" | "bring_your_own";
type CloudStatus = "active" | "suspended" | "disabled";
type CloudInstance = {
    id: string;
    organization_id?: string | null;
    product_id?: string | null;
    saas_app_id?: string | null;
    tenant_id?: string | null;
    cloud_mode: CloudMode;
    status: CloudStatus;
    supabase_url?: string | null;
    supabase_anon_key?: string | null;
    supabase_project_ref?: string | null;
    database_name?: string | null;
    region?: string | null;
    storage_limit?: number;
    storage_used?: number;
    sync_enabled?: boolean;
    auto_backup?: boolean;
    last_connection?: string | null;
    last_sync?: string | null;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
};
type CreateCloudInput = {
    cloud_mode: CloudMode;
    organization_id?: string | null;
    product_id?: string | null;
    saas_app_id?: string | null;
    tenant_id?: string | null;
    status?: CloudStatus;
    supabase_url?: string | null;
    supabase_anon_key?: string | null;
    supabase_project_ref?: string | null;
    database_name?: string | null;
    region?: string | null;
    storage_limit?: number;
    sync_enabled?: boolean;
    auto_backup?: boolean;
    notes?: string | null;
};
type CloudLog = {
    id: string;
    cloud_instance_id: string;
    action: string;
    description?: string | null;
    user_id?: string | null;
    created_at: string;
};
type CloudBackup = {
    id: string;
    cloud_instance_id: string;
    backup_name: string;
    backup_size: number;
    status: string;
    created_at: string;
};
type CloudUsage = {
    id: string;
    cloud_instance_id: string;
    storage_used: number;
    bandwidth: number;
    requests: number;
    updated_at: string;
};
type CloudConnectionTest = {
    ok: boolean;
    latency_ms?: number;
    project_ref?: string | null;
    error?: string;
};

declare class HttpClient {
    readonly baseUrl: string;
    readonly productId?: string;
    readonly applicationId?: string;
    readonly environment?: string;
    private apiKey?;
    private bearerToken?;
    private timeoutMs;
    private fetchImpl;
    constructor(config: MbeukHubConfig);
    setBearerToken(token: string | undefined): void;
    setApiKey(key: string | undefined): void;
    hasAuth(): boolean;
    resolveProductId(explicit?: string): string | undefined;
    private headers;
    request<T>(method: string, path: string, opts?: {
        body?: unknown;
        query?: Record<string, string | undefined>;
        /** Autorise l'appel sans apiKey / bearer (ex: /health) */
        public?: boolean;
    }): Promise<{
        data: T;
        meta?: Record<string, unknown>;
    }>;
    get<T>(path: string, query?: Record<string, string | undefined>, opts?: {
        public?: boolean;
    }): Promise<{
        data: T;
        meta?: Record<string, unknown>;
    }>;
    post<T>(path: string, body?: unknown): Promise<{
        data: T;
        meta?: Record<string, unknown>;
    }>;
    put<T>(path: string, body?: unknown): Promise<{
        data: T;
        meta?: Record<string, unknown>;
    }>;
    patch<T>(path: string, body?: unknown): Promise<{
        data: T;
        meta?: Record<string, unknown>;
    }>;
    delete<T>(path: string): Promise<{
        data: T;
        meta?: Record<string, unknown>;
    }>;
}

declare class ProductsResource {
    private readonly http;
    constructor(http: HttpClient);
    list(opts?: {
        saasAppId?: string;
        active?: boolean;
    }): Promise<{
        products: Product[];
        meta: Record<string, unknown> | undefined;
    }>;
    get(id: string): Promise<Product>;
    create(input: Partial<Product> & {
        name: string;
        chariow_product_id: string;
        price: number;
    }): Promise<Product>;
    update(id: string, patch: Partial<Product>): Promise<Product>;
    /** Soft-delete (is_active = false) */
    remove(id: string): Promise<{
        product: Product;
        soft_deleted: boolean;
    }>;
}

type LicenseTrialInput = {
    email?: string;
    customer_email?: string;
    product_id?: string;
    device_id?: string;
    device_identifier?: string;
    user_id?: string;
};
declare class LicensesResource {
    private readonly http;
    constructor(http: HttpClient);
    list(opts?: {
        email?: string;
        productId?: string;
        limit?: number;
    }): Promise<{
        licenses: License[];
        meta: Record<string, unknown> | undefined;
    }>;
    /**
     * @deprecated Création manuelle de licence **payante** réservée aux admins Hub.
     * Une clé SaaS reçoit `PAID_LICENSE_FORBIDDEN`.
     * Utilisez `checkout.create` (paiement) ou `startTrial` / `auth.register({ start_trial })`.
     */
    create(input: {
        email: string;
        product_id: string;
        duration_days?: number;
        access_type?: string;
        status?: string;
        expiration_date?: string;
        has_cloud_access?: boolean;
        features?: Record<string, boolean>;
    }): Promise<License>;
    /** Vérifie si une licence est valide (appel principal des SaaS). */
    verify(input: {
        email: string;
        product_id?: string;
        device_identifier?: string;
    }): Promise<LicenseVerifyResult>;
    /**
     * Alias documenté de `verify` — contrôle d'accès serveur.
     * Ne jamais faire confiance au résultat côté navigateur seul.
     */
    validateLicense(input: {
        email: string;
        product_id?: string;
        device_identifier?: string;
    }): Promise<LicenseVerifyResult>;
    activate(input: Record<string, unknown>): Promise<unknown>;
    /**
     * Démarre un essai (compte Hub déjà créé pour ce product_id).
     * Préférez `auth.register({ start_trial: true, device_identifier })`.
     */
    startTrial(input: LicenseTrialInput): Promise<unknown>;
    /**
     * Relit l'état licence après paiement (webhook Hub) — ne crée PAS de licence paid.
     */
    sync(input: Record<string, unknown>): Promise<unknown>;
}

declare class InfluencersResource {
    private readonly http;
    constructor(http: HttpClient);
    list(): Promise<{
        influencers: Influencer[];
        meta: Record<string, unknown> | undefined;
    }>;
    get(id: string): Promise<Influencer>;
    /**
     * Crée un ambassadeur + compte Auth.
     * Retourne aussi temporary_password (à communiquer une seule fois).
     */
    create(input: {
        name: string;
        email: string;
        commission_percentage: number;
        promo_code?: string;
        bonus_days_offered?: number;
        phone?: string;
        country?: string;
        cni_number?: string;
    }): Promise<{
        influencer: Influencer;
        temporary_password: string;
    }>;
    update(id: string, patch: Partial<Pick<Influencer, "name" | "email" | "phone" | "country" | "commission_percentage" | "promo_code" | "bonus_days_offered" | "is_active" | "cni_number">>): Promise<Influencer>;
    /** Soft-delete (is_active = false) */
    remove(id: string): Promise<{
        influencer: Influencer;
        soft_deleted: boolean;
    }>;
    validatePromo(promo_code: string): Promise<{
        valid: boolean;
        reason?: string;
        message?: string;
        influencer_id?: string;
        influencer_name?: string;
        promo_code?: string;
        bonus_days_offered?: number;
        source?: string;
    }>;
    /**
     * Construit l'URL d'affiliation storefront à partir du code promo.
     * @example hub.influencers.buildAffiliateUrl('https://shop.example.com', 'AMB4F2A')
     */
    buildAffiliateUrl(storefrontBaseUrl: string, promoCode: string): string;
}

type CheckoutInput = {
    product_id?: string;
    /** Email client (alias accepté : email) */
    customer_email?: string;
    email?: string;
    /**
     * Code promo ambassadeur ou slug de lien affilié.
     * Alias acceptés : promo_code, affiliate_slug, ref
     * Priorité si plusieurs : promo_code / affiliate_slug / ref
     * (le code saisi manuellement doit être passé en promo_code).
     */
    affiliate_slug?: string;
    promo_code?: string;
    ref?: string;
    /** Ref lien affilié (priorité inférieure au code manuel) */
    link_ref?: string;
};
type CheckoutSession = {
    success?: boolean;
    checkout_url?: string;
    product_price?: number;
    influencer_id?: string | null;
    sale_id?: string | null;
    [key: string]: unknown;
};
declare class CheckoutResource {
    private readonly http;
    constructor(http: HttpClient);
    /**
     * Initie un checkout Chariow via le Hub (prix & merchant résolus SERVEUR).
     * Ne jamais activer une licence sur la seule page /success — attendre le webhook Hub.
     */
    create(input: CheckoutInput): Promise<CheckoutSession>;
}

declare class SaasAppsResource {
    private readonly http;
    constructor(http: HttpClient);
    list(): Promise<SaasApp[]>;
}

/** Gestion des clés API — nécessite un bearerToken admin. */
declare class ApiKeysResource {
    private readonly http;
    constructor(http: HttpClient);
    list(): Promise<ApiKeyRecord[]>;
    create(input: {
        name: string;
        saas_app_id?: string;
        scopes?: string[];
        expires_at?: string;
    }): Promise<CreateApiKeyResult>;
    revoke(id: string): Promise<{
        api_key: ApiKeyRecord;
        revoked: boolean;
    }>;
}

declare class CloudResource {
    private readonly http;
    constructor(http: HttpClient);
    /**
     * Résout le Cloud actif pour le SaaS (appel au démarrage).
     * Renvoie mode, URL, anon key et paramètres.
     */
    getCloud(opts?: {
        tenantId?: string;
        productId?: string;
        organizationId?: string;
        saasAppId?: string;
        id?: string;
    }): Promise<CloudInstance>;
    list(filters?: Record<string, string | undefined>): Promise<CloudInstance[]>;
    createCloud(input: CreateCloudInput): Promise<CloudInstance>;
    updateCloud(input: Partial<CreateCloudInput> & {
        id: string;
    }): Promise<CloudInstance>;
    deleteCloud(id: string): Promise<boolean>;
    testConnection(input: {
        supabase_url: string;
        supabase_anon_key: string;
    }): Promise<CloudConnectionTest>;
    getUsage(cloudInstanceId: string): Promise<CloudUsage | null>;
    getLogs(cloudInstanceId?: string, limit?: number): Promise<CloudLog[]>;
    getBackups(cloudInstanceId?: string): Promise<CloudBackup[]>;
}

declare class AuthResource {
    private readonly http;
    constructor(http: HttpClient);
    /**
     * Crée un compte email+mdp pour un produit.
     * Optionnel : `start_trial: true` + `device_identifier` pour démarrer l'essai immédiatement.
     */
    register(input: AuthRegisterInput): Promise<AuthRegisterResult>;
    login(input: AuthLoginInput): Promise<AuthLoginResult>;
    refreshSession(input: {
        refresh_token: string;
    }): Promise<AuthRefreshResult>;
    /**
     * Mot de passe oublié : génère un nouveau MDP et l'envoie par email (Brevo).
     * Fournissez `brevo` si le Hub n'a pas HUB_BREVO_* en env.
     */
    forgotPassword(input: {
        email: string;
        product_id: string;
        brevo?: {
            apiKey: string;
            senderEmail: string;
            senderName?: string;
        };
    }): Promise<{
        sent: boolean;
        email?: string;
        product_id?: string;
        message?: string;
    }>;
    /** @deprecated Préférez forgotPassword (MDP auto envoyé par email). */
    requestPasswordReset(input: {
        email: string;
        product_id: string;
        brevo?: {
            apiKey: string;
            senderEmail: string;
            senderName?: string;
        };
    }): Promise<{
        sent: boolean;
        email?: string;
        product_id?: string;
        message?: string;
    }>;
    resetPassword(input: {
        token: string;
        new_password: string;
    }): Promise<{
        reset: boolean;
    }>;
    logout(input: {
        session_token: string;
    }): Promise<{
        logged_out: boolean;
    }>;
    revokeDevice(input: {
        email: string;
        product_id: string;
        device_identifier: string;
        session_token?: string;
    }): Promise<{
        revoked: boolean;
    }>;
}

/**
 * Client officiel du Hub central MbeukTechnologies.
 *
 * @example
 * ```ts
 * const hub = new MbeukHub({
 *   baseUrl: process.env.MBEUK_HUB_URL!,
 *   apiKey: process.env.MBEUK_HUB_API_KEY!, // serveur uniquement
 *   productId: process.env.MBEUK_PRODUCT_ID!,
 *   applicationId: process.env.MBEUK_APPLICATION_ID,
 *   environment: "production",
 * });
 *
 * const access = await hub.licenses.validateLicense({
 *   email: "user@example.com",
 * });
 * ```
 */
declare class MbeukHub {
    /** Version du package SDK */
    static readonly version: "2.0.0";
    readonly version: "2.0.0";
    readonly products: ProductsResource;
    readonly licenses: LicensesResource;
    readonly influencers: InfluencersResource;
    readonly checkout: CheckoutResource;
    readonly saasApps: SaasAppsResource;
    readonly apiKeys: ApiKeysResource;
    readonly cloud: CloudResource;
    readonly auth: AuthResource;
    private readonly http;
    private readonly config;
    constructor(config: MbeukHubConfig);
    /** productId configuré (UUID Hub) */
    get productId(): string | undefined;
    /** applicationId / saas_app_id Hub */
    get applicationId(): string | undefined;
    get environment(): string | undefined;
    /** Snapshot de config (sans secret apiKey) */
    getPublicConfig(): {
        baseUrl: string;
        productId: string | undefined;
        applicationId: string | undefined;
        developerRef: string | undefined;
        environment: string | undefined;
        sdkVersion: "2.0.0";
        hasApiKey: boolean;
    };
    setBearerToken(token: string | undefined): void;
    setApiKey(key: string | undefined): void;
    health(): Promise<{
        status: string;
        service: string;
        version: string;
        timestamp: string;
    }>;
}
declare function createMbeukHub(config: MbeukHubConfig): MbeukHub;
/**
 * Valide la présence des env serveur recommandées (ne lit pas les secrets).
 * À appeler au boot du backend SaaS.
 */
declare function assertHubEnv(env: {
    MBEUK_HUB_URL?: string;
    MBEUK_HUB_API_KEY?: string;
    MBEUK_PRODUCT_ID?: string;
}): void;

declare class MbeukHubError extends Error {
    readonly code: string;
    readonly status: number;
    readonly details?: unknown;
    constructor(message: string, opts: {
        code: string;
        status: number;
        details?: unknown;
    });
}

/**
 * Codes d'erreur Hub / SDK fréquents (référence développeur).
 * Le Hub peut en renvoyer d'autres ; toujours lire `MbeukHubError.code`.
 */
declare const HubErrorCodes: {
    readonly INVALID_CONFIG: "INVALID_CONFIG";
    readonly INVALID_API_KEY: "INVALID_API_KEY";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN_SCOPE: "FORBIDDEN_SCOPE";
    readonly TENANT_BINDING_REQUIRED: "TENANT_BINDING_REQUIRED";
    readonly TENANT_MISMATCH: "TENANT_MISMATCH";
    readonly PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND";
    readonly LICENSE_NOT_FOUND: "LICENSE_NOT_FOUND";
    readonly LICENSE_EXPIRED: "LICENSE_EXPIRED";
    readonly LICENSE_INACTIVE: "LICENSE_INACTIVE";
    readonly DEVICE_LIMIT_REACHED: "DEVICE_LIMIT_REACHED";
    readonly PAID_LICENSE_FORBIDDEN: "PAID_LICENSE_FORBIDDEN";
    readonly ACCOUNT_REQUIRED: "ACCOUNT_REQUIRED";
    readonly EMAIL_ALREADY_LICENSED: "EMAIL_ALREADY_LICENSED";
    readonly TRIAL_DISABLED: "TRIAL_DISABLED";
    readonly AMOUNT_MISMATCH: "AMOUNT_MISMATCH";
    readonly CHECKOUT_FAILED: "CHECKOUT_FAILED";
    readonly TIMEOUT: "TIMEOUT";
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    readonly HTTP_ERROR: "HTTP_ERROR";
    readonly HUB_ENV_MISSING: "HUB_ENV_MISSING";
};

/**
 * Attribution influenceur — règles côté SaaS (affichage / cookie).
 * L'autorité finale reste le Hub au checkout (affiliate_slug).
 *
 * Priorité recommandée :
 * 1. code saisi volontairement par l'utilisateur
 * 2. ref provenant d'un lien affilié (?ref=)
 */
declare function resolveAffiliateAttribution(opts: {
    /** Code promo saisi dans un formulaire */
    manualCode?: string | null;
    /** Valeur ?ref= / cookie / session affiliée */
    linkRef?: string | null;
}): string | undefined;
/** Extrait `ref` d'une URL (query). */
declare function extractRefFromUrl(url: string | URL): string | undefined;

export { type ApiKeyRecord, type AuthLoginInput, type AuthLoginResult, type AuthRefreshResult, type AuthRegisterInput, type AuthRegisterResult, type CheckoutInput, type CheckoutSession, type CloudBackup, type CloudConnectionTest, type CloudInstance, type CloudLog, type CloudMode, type CloudStatus, type CloudUsage, type CreateApiKeyResult, type CreateCloudInput, HubErrorCodes, type Influencer, type License, type LicenseTrialInput, type LicenseVerifyResult, MbeukHub, type MbeukHubConfig, MbeukHubError, type Product, SDK_VERSION, type SaasApp, type SdkEnvironment, assertHubEnv, createMbeukHub, extractRefFromUrl, resolveAffiliateAttribution };
