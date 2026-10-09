/**
 * HubService — couche serveur Mbeuk Hub Central (SDK 2.0.0).
 * Utilisé exclusivement par les Edge Functions Supabase (jamais côté frontend).
 */
import {
  MbeukHub,
  MbeukHubError,
  assertHubEnv,
  resolveAffiliateAttribution,
  type LicenseVerifyResult,
} from '../vendor/mbeuk-hub-sdk/index.js';

export type SafeHubError = {
  code: string;
  message: string;
  status: number;
  details?: unknown;
};

let hubInstance: MbeukHub | null = null;

function readHubEnv() {
  return {
    MBEUK_HUB_URL: Deno.env.get('MBEUK_HUB_URL') ?? '',
    MBEUK_HUB_API_KEY: Deno.env.get('MBEUK_HUB_API_KEY') ?? '',
    MBEUK_PRODUCT_ID: Deno.env.get('MBEUK_PRODUCT_ID') ?? '',
    MBEUK_APPLICATION_ID: Deno.env.get('MBEUK_APPLICATION_ID') ?? undefined,
    MBEUK_ENVIRONMENT: (Deno.env.get('MBEUK_ENVIRONMENT') ?? 'production') as
      | 'development'
      | 'staging'
      | 'production',
  };
}

/** Instancie ou retourne le client MbeukHub (singleton par isolate Deno). */
export function getHubClient(): MbeukHub {
  if (hubInstance) return hubInstance;

  const env = readHubEnv();
  assertHubEnv(env);

  hubInstance = new MbeukHub({
    baseUrl: env.MBEUK_HUB_URL,
    apiKey: env.MBEUK_HUB_API_KEY,
    productId: env.MBEUK_PRODUCT_ID,
    applicationId: env.MBEUK_APPLICATION_ID || undefined,
    environment: env.MBEUK_ENVIRONMENT,
    timeoutMs: 90_000,
  });

  return hubInstance;
}

/** Vérifie que la configuration Hub est présente (sans exposer les secrets). */
export function ensureHubConfigured(): void {
  const env = readHubEnv();
  if (!env.MBEUK_HUB_URL || !env.MBEUK_HUB_API_KEY || !env.MBEUK_PRODUCT_ID) {
    throw new MbeukHubError(
      'Configuration Hub incomplète. Définissez MBEUK_HUB_URL, MBEUK_HUB_API_KEY et MBEUK_PRODUCT_ID côté serveur.',
      { code: 'HUB_ENV_MISSING', status: 503 },
    );
  }
  assertHubEnv(env);
}

/** Convertit une erreur Hub en réponse sûre pour l'application. */
export function toSafeHubError(err: unknown): SafeHubError {
  if (err instanceof MbeukHubError) {
    return {
      code: err.code,
      message: err.message,
      status: err.status || 502,
      details: err.details,
    };
  }
  if (err instanceof Error) {
    return { code: 'INTERNAL_ERROR', message: err.message, status: 500 };
  }
  return { code: 'INTERNAL_ERROR', message: 'Erreur Hub inattendue.', status: 500 };
}

/** Codes Hub nécessitant un refus d'accès strict (pas de fallback cross-tenant). */
export function isSecurityDenial(code: string): boolean {
  return code === 'TENANT_MISMATCH' || code === 'TENANT_BINDING_REQUIRED' || code === 'PAID_LICENSE_FORBIDDEN';
}

/** Erreur schema Hub Central (licenses.access_type manquant cote Hub, pas MbeukAgri). */
export function isHubSchemaAccessTypeError(err: unknown): boolean {
  const msg = toSafeHubError(err).message.toLowerCase();
  return msg.includes('licenses.access_type') || msg.includes('access_type does not exist');
}

export function hubSchemaAccessTypeMessage(): string {
  return (
    'Le serveur Mbeuk Hub Central doit etre migre (colonne licenses.access_type). ' +
    'Cette migration s applique sur la base Hub Central (ex: Supabase de https://mbeukhub.vercel.app), ' +
    'pas sur le Supabase MbeukAgri. Voir supabase/migrations/HUB_CENTRAL_licenses_access_type.sql'
  );
}

function isTrialAlreadyUsed(safe: SafeHubError): boolean {
  return safe.code === 'TRIAL_ALREADY_USED' || safe.code === 'TRIAL_ALREADY_STARTED';
}

function extractHubErrorCode(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;
  if (typeof d.code === 'string' && d.code.trim()) return d.code.trim();
  if (d.error && typeof d.error === 'object') {
    const err = d.error as Record<string, unknown>;
    if (typeof err.code === 'string' && err.code.trim()) return err.code.trim();
  }
  return null;
}

/** Message utilisateur pour echec demarrage essai Hub. */
export function trialFailureMessage(safe: SafeHubError): string {
  const nestedCode = extractHubErrorCode(safe.details);
  const code = nestedCode || safe.code;

  if (code === 'FORBIDDEN_SCOPE') {
    return 'Cle API Hub sans permission licenses:write. Ajoutez ce scope sur la cle mbs_... (admin Hub), puis redeployez le Hub.';
  }
  if (code === 'ACCOUNT_REQUIRED') {
    return 'Compte Hub introuvable pour cet email et produit. Recreez le compte ou reconnectez-vous.';
  }
  if (code === 'TRIAL_DISABLED' || safe.message.toLowerCase().includes('essai desactive')) {
    return 'Essai gratuit desactive sur ce produit. Activez l\'essai dans l\'admin Hub Central (produit MbeukAgri).';
  }
  if (code === 'LICENSE_NOT_FOUND') {
    return 'Aucune licence active pour ce compte. Réessayez dans quelques secondes ou utilisez « Synchroniser mon accès ».';
  }
  if (code === 'EMAIL_ALREADY_LICENSED' || code === 'USER_ALREADY_LICENSED' || code === 'DEVICE_TRIAL_USED') {
    return 'Un essai ou une licence existe deja pour ce compte ou cet appareil. Utilisez « Synchroniser mon accès ».';
  }
  if (code === 'PRODUCT_NOT_FOUND') {
    return 'Produit Hub introuvable. Verifiez MBEUK_PRODUCT_ID dans les secrets Supabase MbeukAgri.';
  }
  if (code === 'DEVICE_LIMIT_REACHED') {
    return 'Quota appareil Hub atteint lors de la verification. Reessayez ou utilisez « Synchroniser mon accès ».';
  }
  if (code === 'UNAUTHORIZED' || code === 'UNAUTHORIZED_NO_AUTH_HEADER') {
    return 'Cle API Hub refusee par le Hub legacy. Redeployez mbeukhub.vercel.app avec le correctif legacy-proxy, ou verifiez MBEUK_HUB_API_KEY.';
  }
  const nested = extractHubNestedMessage(safe.details);
  if (nested) return nested;
  if (safe.message && !safe.message.startsWith('Essai impossible cote Hub')) {
    return safe.message;
  }
  return (
    'Essai impossible cote Hub Central. Verifiez: Hub redeploye (correctif proxy), migration 038 scopes, ' +
    'essai active sur le produit, LICENSE_JWT_SECRET sur Vercel Hub.'
  );
}

function extractHubNestedMessage(details: unknown): string | null {
  if (typeof details === 'string' && details.trim()) return details.trim();
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;
  if (typeof d.error === 'string' && d.error.trim()) return d.error.trim();
  if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
  if (d.error && typeof d.error === 'object') {
    const err = d.error as Record<string, unknown>;
    if (typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  }
  return null;
}

/** Demarre un essai Hub avec detection essai deja actif. */
export async function startTrialWithFallback(input: {
  email: string;
  product_id: string;
  user_id?: string;
  device_identifier?: string;
  device_id?: string;
}): Promise<{ started: boolean; already_active: boolean }> {
  const hub = getHubClient();
  if (!input.device_identifier) {
    throw new MbeukHubError('Empreinte appareil requise pour démarrer l\'essai.', {
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  }

  const body = {
    customer_email: input.email,
    email: input.email,
    product_id: input.product_id,
    // Hub : un seul identifiant appareil (empreinte) pour start + verify
    device_identifier: input.device_identifier,
    device_id: input.device_identifier || input.device_id || input.device_identifier,
    ...(input.user_id ? { user_id: input.user_id } : {}),
  };

  try {
    await hub.licenses.startTrial(body);
    const created = await resolveHubLicenseForUser({
      email: input.email,
      device_identifier: input.device_identifier,
    });
    if (created.valid) {
      return { started: true, already_active: false };
    }
    try {
      await syncLicenseForUser({
        email: input.email,
        device_identifier: input.device_identifier,
      });
      const synced = await resolveHubLicenseForUser({
        email: input.email,
        device_identifier: input.device_identifier,
      });
      if (synced.valid) {
        return { started: true, already_active: false };
      }
    } catch (syncErr) {
      console.warn('[startTrialWithFallback] post-start sync failed', toSafeHubError(syncErr).message);
    }
    throw new MbeukHubError(trialFailureMessage({
      code: created.reason || 'LICENSE_NOT_FOUND',
      message: created.message || 'Essai demarre mais licence introuvable.',
      status: 502,
      details: null,
    }), {
      code: created.reason || 'LICENSE_NOT_FOUND',
      status: 502,
    });
  } catch (err) {
    const safe = toSafeHubError(err);
    if (safe.code === 'DEVICE_TRIAL_USED') {
      throw new MbeukHubError(trialFailureMessage(safe), {
        code: safe.code,
        status: safe.status,
        details: safe.details,
      });
    }
    if (isTrialAlreadyUsed(safe)) {
      const existing = await resolveHubLicenseForUser({
        email: input.email,
        device_identifier: input.device_identifier,
      });
      if (existing.valid) {
        return { started: false, already_active: true };
      }
    }
    if (
      safe.code === 'EMAIL_ALREADY_LICENSED'
      || safe.code === 'USER_ALREADY_LICENSED'
      || safe.code === 'UNIQUE_VIOLATION'
    ) {
      const existing = await validateLicenseForUser({
        email: input.email,
        device_identifier: input.device_identifier,
      });
      const accessType = existing.license?.access_type ?? existing.status ?? '';
      if (existing.valid) {
        return { started: false, already_active: true };
      }
      if (accessType === 'trial' || String(accessType).includes('trial')) {
        const withoutDevice = await validateLicenseForUser({ email: input.email });
        if (withoutDevice.valid) {
          return { started: false, already_active: true };
        }
      }
    }
    if (isHubSchemaAccessTypeError(err)) throw err;

    const existing = await validateLicenseForUser({
      email: input.email,
      device_identifier: input.device_identifier,
    });
    const accessType = existing.license?.access_type ?? existing.status ?? '';
    if (existing.valid && (accessType === 'trial' || String(accessType).includes('trial'))) {
      return { started: false, already_active: true };
    }

    try {
      await syncLicenseForUser({
        email: input.email,
        device_identifier: input.device_identifier,
      });
      const synced = await validateLicenseForUser({
        email: input.email,
        device_identifier: input.device_identifier,
      });
      const syncedType = synced.license?.access_type ?? synced.status ?? '';
      if (synced.valid && (syncedType === 'trial' || String(syncedType).includes('trial'))) {
        return { started: false, already_active: true };
      }
    } catch (syncErr) {
      console.warn('[startTrialWithFallback] sync fallback failed', toSafeHubError(syncErr).message);
    }

    throw new MbeukHubError(trialFailureMessage(safe), {
      code: safe.code === 'HTTP_ERROR' ? 'TRIAL_FAILED' : safe.code,
      status: safe.status,
      details: safe.details,
    });
  }
}

/** Résout l'attribution affiliée : code manuel > ?ref= */
export function resolveAffiliate(opts: {
  manualCode?: string | null;
  linkRef?: string | null;
}): string | undefined {
  return resolveAffiliateAttribution(opts);
}

export async function validateLicenseForUser(input: {
  email: string;
  device_identifier?: string;
}): Promise<LicenseVerifyResult> {
  const hub = getHubClient();
  return hub.licenses.validateLicense({
    email: input.email,
    device_identifier: input.device_identifier,
  });
}

/** Valide la licence Hub avec repli sans appareil si quota DEVICE_LIMIT. */
export async function resolveHubLicenseForUser(input: {
  email: string;
  device_identifier?: string;
}): Promise<LicenseVerifyResult> {
  let result = await validateLicenseForUser(input);
  if (result.valid) return result;

  const reason = (result.reason ?? '').toUpperCase();
  const hasLicense = Boolean(result.license?.id || result.license?.access_type);
  if (reason.includes('DEVICE') || (hasLicense && input.device_identifier)) {
    const fallback = await validateLicenseForUser({ email: input.email });
    if (fallback.valid) return fallback;
    if (hasLicense && result.license) return result;
  }
  return result;
}

export async function syncLicenseForUser(input: {
  email: string;
  device_identifier?: string;
}): Promise<unknown> {
  const hub = getHubClient();
  const productId = Deno.env.get('MBEUK_PRODUCT_ID')!;
  return hub.licenses.sync({
    email: input.email,
    product_id: productId,
    device_identifier: input.device_identifier,
  });
}

export type AffiliatePromoValidation = {
  valid: boolean;
  reason?: string;
  message?: string;
  influencer_id?: string;
  influencer_name?: string;
  promo_code?: string;
  bonus_days_offered?: number;
  source?: string;
};

/** Valide un code ambassadeur via Hub Central (sans exposer la commission). */
export async function validateAffiliatePromoCode(
  promo_code: string,
): Promise<AffiliatePromoValidation> {
  const env = readHubEnv();
  const code = promo_code.trim();
  if (!code) {
    return { valid: false, reason: 'VALIDATION_ERROR', message: 'Code requis.' };
  }

  const res = await fetch(`${env.MBEUK_HUB_URL.replace(/\/+$/, '')}/api/v1/affiliate/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': env.MBEUK_HUB_API_KEY,
      ...(env.MBEUK_APPLICATION_ID ? { 'X-Mbeuk-Application-Id': env.MBEUK_APPLICATION_ID } : {}),
      ...(env.MBEUK_PRODUCT_ID ? { 'X-Mbeuk-Product-Id': env.MBEUK_PRODUCT_ID } : {}),
    },
    body: JSON.stringify({ promo_code: code }),
  });

  const json = await res.json().catch(() => ({})) as {
    data?: AffiliatePromoValidation;
    error?: { message?: string; code?: string };
    message?: string;
    code?: string;
  };

  if (!res.ok) {
    const safe = toSafeHubError(new Error(json.error?.message || json.message || 'Validation impossible.'));
    return {
      valid: false,
      reason: json.error?.code || safe.code,
      message: json.error?.message || safe.message,
    };
  }

  return json.data ?? { valid: false, reason: 'INVALID_RESPONSE', message: 'Réponse Hub invalide.' };
}

export { MbeukHubError, type LicenseVerifyResult };
