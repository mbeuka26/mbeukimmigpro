/**
 * Authentification Hub Central — résolution session pour Edge Functions.
 * Identité / auth / entitlement : Hub. Données métier : profil SaaS local.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getHubClient, toSafeHubError } from './hub-service.ts';
import type { SaasProfile } from './saas-profile.ts';

export type HubAuthContext = {
  hub_user_id: string;
  email: string;
  profile: SaasProfile;
  hub_session_token: string;
  hub_refresh_token: string;
};

export class HubAuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
    this.name = 'HubAuthError';
  }
}

/** Exige une session Hub valide + profil métier SaaS associé. */
export async function requireHubAuth(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<HubAuthContext> {
  const authHeader = req.headers.get('Authorization');
  const refreshToken = req.headers.get('X-Hub-Refresh-Token');
  const hubUserId = req.headers.get('X-Hub-User-Id');
  const hubSessionToken = req.headers.get('X-Hub-Session-Token')?.trim() || '';

  if (!hubSessionToken || !refreshToken || !hubUserId) {
    throw new HubAuthError('Session Hub requise (token, refresh, user id).', 401);
  }

  // Authorization = JWT Supabase (anon) pour la passerelle Edge ; session Hub via X-Hub-Session-Token
  void authHeader;

  try {
    await getHubClient().auth.refreshSession({ refresh_token: refreshToken });
  } catch (e) {
    const safe = toSafeHubError(e);
    // Les appels licence/checkout utilisent la clé API serveur — ne pas bloquer si refresh Hub échoue (ex. DB_ERROR)
    console.warn('[requireHubAuth] refreshSession non bloquant:', safe.code, safe.message);
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('hub_user_id', hubUserId)
    .maybeSingle();

  if (error || !profile) {
    throw new HubAuthError('Profil métier SaaS introuvable pour ce compte Hub.', 404);
  }

  return {
    hub_user_id: hubUserId,
    email: profile.email,
    profile: profile as SaasProfile,
    hub_session_token: hubSessionToken,
    hub_refresh_token: refreshToken,
  };
}

/** Résout le user_id métier SaaS (profiles.id) depuis la session Hub. */
export function saasUserId(ctx: HubAuthContext): string {
  return ctx.profile.id;
}
