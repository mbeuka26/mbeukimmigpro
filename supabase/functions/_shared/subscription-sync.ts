/**
 * Synchronise le cache local `subscriptions` à partir de la réponse Hub Central.
 * Hub Central reste l'autorité ; la table locale est un cache de corrélation.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { LicenseVerifyResult } from './hub-service.ts';

export type SubscriptionCache = {
  plan: string;
  status: string;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  max_devices: number;
  hub_license_id?: string | null;
  hub_access_type?: string | null;
};

const EMPTY_LICENSE: LicenseVerifyResult = {
  valid: false,
  reason: 'NO_LICENSE_DATA',
  status: 'none',
};

export function normalizeLicenseResult(result?: LicenseVerifyResult | null): LicenseVerifyResult {
  return result ?? EMPTY_LICENSE;
}

function inferPlan(result: LicenseVerifyResult): string {
  const accessType = result.license?.access_type ?? result.status ?? '';
  if (accessType === 'trial') return 'trial';
  if (!result.valid && !result.license?.id) return 'none';
  return 'Professional';
}

function inferStatus(result: LicenseVerifyResult): string {
  const embedded = result.license;
  const embeddedType = embedded?.access_type ?? '';
  const embeddedExp = embedded?.expiration_date ?? embedded?.expires_at ?? null;

  // Licence Hub présente (ex. DEVICE_LIMIT) — conserver trial/active, ne pas passer à "none"
  if (embedded?.id && embeddedType) {
    if (embeddedType === 'trial') {
      if (embeddedExp && new Date(embeddedExp).getTime() < Date.now()) return 'expired';
      return 'trial';
    }
    if (embeddedExp && new Date(embeddedExp).getTime() < Date.now()) return 'expired';
    return 'active';
  }

  if (!result.valid) {
    const reason = (result.reason ?? '').toUpperCase();
    if (
      reason.includes('NO_LICENSE')
      || reason.includes('NOT_FOUND')
      || reason.includes('NO_ENTITLEMENT')
      || reason === 'LICENSE_LOOKUP_FAILED'
    ) {
      return 'none';
    }
    if (reason.includes('PENDING')) return 'pending';
    if (reason.includes('TRIAL') && reason.includes('EXPIRED')) return 'expired';
    if (reason.includes('EXPIRED')) return 'expired';
    return 'none';
  }
  const accessType = result.license?.access_type ?? result.status ?? '';
  if (accessType === 'trial') return 'trial';
  return 'active';
}

/** Mappe une réponse Hub vers l'état d'abonnement local. */
export function mapHubToSubscription(result?: LicenseVerifyResult | null): SubscriptionCache {
  const license = normalizeLicenseResult(result);
  const expiration =
    license.expiration_date
    ?? license.expires_at
    ?? license.license?.expiration_date
    ?? license.license?.expires_at
    ?? null;
  const isTrial = inferStatus(license) === 'trial';

  return {
    plan: inferPlan(license),
    status: inferStatus(license),
    trial_started_at: isTrial ? new Date().toISOString() : null,
    trial_ends_at: isTrial ? expiration : null,
    expires_at: !isTrial ? expiration : null,
    max_devices: license.max_devices ?? license.license?.max_devices ?? 2,
    hub_license_id: license.license?.id ?? null,
    hub_access_type: license.license?.access_type ?? license.status ?? null,
  };
}

/** Met à jour subscriptions + license_history pour un utilisateur SaaS. */
export async function applyHubLicenseToUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  email: string,
  result: LicenseVerifyResult | null | undefined,
  event: string,
): Promise<SubscriptionCache> {
  const license = normalizeLicenseResult(result);
  const mapped = mapHubToSubscription(license);

  const { error: subErr } = await supabaseAdmin.from('subscriptions').upsert({
    user_id: userId,
    plan: mapped.plan,
    status: mapped.status,
    trial_started_at: mapped.trial_started_at,
    trial_ends_at: mapped.trial_ends_at,
    expires_at: mapped.expires_at,
    max_devices: mapped.max_devices,
    hub_license_id: mapped.hub_license_id,
    hub_access_type: mapped.hub_access_type,
    hub_last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (subErr) {
    throw new Error(`subscriptions: ${subErr.message}. Appliquez les migrations MbeukAgri (000005, 000007).`);
  }

  await supabaseAdmin.from('profiles').update({
    hub_email: email,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);

  await supabaseAdmin.from('license_history').insert({
    user_id: userId,
    event,
    details: {
      source: 'mbeuk_hub',
      valid: license.valid,
      reason: license.reason ?? null,
      hub_license_id: mapped.hub_license_id,
      expires_at: mapped.expires_at ?? mapped.trial_ends_at,
    },
  });

  return mapped;
}
