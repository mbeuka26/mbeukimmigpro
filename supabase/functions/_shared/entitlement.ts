import { evaluateAccess } from '../../../shared/entitlement/access.ts';
import { serviceClient } from './supabase.ts';
import { resolveHubLicenseForUser, ensureHubConfigured } from './hub-service.ts';
import { applyHubLicenseToUser } from './subscription-sync.ts';

export class EntitlementError extends Error {
  constructor(readonly reason: string) {
    super('ENTITLEMENT_REQUIRED');
  }
}

/** Au-delà, le cache est resynchronisé auprès du Hub (révocation/suspension vues en <= 5 min). */
const MAX_CACHE_AGE_MS = 5 * 60 * 1000;

const COLUMNS = 'status, trial_ends_at, expires_at, hub_last_sync_at';

/** Exige un essai actif ou une licence valide (Hub = autorité, cache rafraîchi si périmé). */
export async function requireEntitlement(userId: string) {
  const db = serviceClient();
  let { data } = await db.from('subscriptions').select(COLUMNS).eq('user_id', userId).maybeSingle();

  const syncedAt = data?.hub_last_sync_at ? new Date(data.hub_last_sync_at).getTime() : 0;
  if (Date.now() - syncedAt > MAX_CACHE_AGE_MS) {
    try {
      ensureHubConfigured();
      const { data: profile } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
      if (profile?.email) {
        const hubResult = await resolveHubLicenseForUser({ email: profile.email });
        await applyHubLicenseToUser(db, userId, profile.email, hubResult, 'hub_sync');
        ({ data } = await db.from('subscriptions').select(COLUMNS).eq('user_id', userId).maybeSingle());
      }
    } catch (e) {
      // Hub injoignable : aucune politique de grâce n'est définie ; on s'appuie sur le cache
      // dont les dates de fin restent contrôlées par l'horloge serveur.
      console.warn('[entitlement] refresh Hub impossible, cache utilisé', e instanceof Error ? e.message : e);
    }
  }

  const decision = evaluateAccess(data);
  if (!decision.allowed) throw new EntitlementError(decision.reason);
  return decision;
}

export const ENTITLEMENT_MESSAGE =
  "Ce compte ne possède aucune licence active. Achetez une licence ou démarrez l'essai gratuit.";
