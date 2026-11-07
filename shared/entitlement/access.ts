/**
 * Règle d'accès côté serveur (fail-closed) à partir du cache `subscriptions`
 * synchronisé depuis le Hub Central. Le cache n'est modifiable que par le
 * service_role (voir migration 20261107000000). Horloge = serveur.
 */
export type SubscriptionRow = {
  status?: string | null;
  trial_ends_at?: string | null;
  expires_at?: string | null;
} | null | undefined;

export type AccessDecision =
  | { allowed: true; kind: 'trial' | 'license'; endsAt: string }
  | { allowed: false; reason: 'NO_SUBSCRIPTION' | 'NO_ENTITLEMENT' | 'EXPIRED' | 'NO_END_DATE' };

function ts(value?: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export function evaluateAccess(sub: SubscriptionRow, now: Date = new Date()): AccessDecision {
  if (!sub) return { allowed: false, reason: 'NO_SUBSCRIPTION' };
  const status = String(sub.status ?? '').toLowerCase();
  if (status !== 'trial' && status !== 'active') {
    return { allowed: false, reason: status === 'expired' ? 'EXPIRED' : 'NO_ENTITLEMENT' };
  }
  const endRaw = status === 'trial' ? (sub.trial_ends_at ?? sub.expires_at) : sub.expires_at;
  const end = ts(endRaw);
  // Une licence/essai sans date de fin vérifiable n'ouvre pas l'accès.
  if (end === null) return { allowed: false, reason: 'NO_END_DATE' };
  if (end <= now.getTime()) return { allowed: false, reason: 'EXPIRED' };
  return { allowed: true, kind: status === 'trial' ? 'trial' : 'license', endsAt: endRaw as string };
}
