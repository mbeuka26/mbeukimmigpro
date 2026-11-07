import { evaluateAccess } from '../../../shared/entitlement/access.ts';
import { serviceClient } from './supabase.ts';

export class EntitlementError extends Error {
  constructor(readonly reason: string) {
    super('ENTITLEMENT_REQUIRED');
  }
}

/** Exige un essai actif ou une licence valide (cache Hub, lu côté serveur). */
export async function requireEntitlement(userId: string) {
  const { data } = await serviceClient()
    .from('subscriptions')
    .select('status, trial_ends_at, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  const decision = evaluateAccess(data);
  if (!decision.allowed) throw new EntitlementError(decision.reason);
  return decision;
}

export const ENTITLEMENT_MESSAGE =
  "Ce compte ne possède aucune licence active. Achetez une licence ou démarrez l'essai gratuit.";
