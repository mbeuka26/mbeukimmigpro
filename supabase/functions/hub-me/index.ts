// hub-me — Profil métier SaaS + entitlement (Hub = autorité, cache rafraîchi à chaque appel).
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { HubAuthError, requireHubAuth } from '../_shared/hub-session-auth.ts';
import {
  ensureHubConfigured,
  validateLicenseForUser,
  toSafeHubError,
} from '../_shared/hub-service.ts';
import { applyHubLicenseToUser } from '../_shared/subscription-sync.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const ctx = await requireHubAuth(req, supabaseAdmin);

    let subscription = null;
    let entitlement_source: 'hub_live' | 'local_cache' = 'hub_live';

    try {
      ensureHubConfigured();
      const hubResult = await validateLicenseForUser({ email: ctx.email });
      subscription = await applyHubLicenseToUser(
        supabaseAdmin,
        ctx.profile.id,
        ctx.email,
        hubResult,
        'hub_me_refresh',
      );
    } catch (refreshErr) {
      console.warn('[hub-me] live Hub refresh failed, using cache', toSafeHubError(refreshErr).message);
      entitlement_source = 'local_cache';
      const { data } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', ctx.profile.id)
        .maybeSingle();
      subscription = data ?? null;
    }

    return json({
      ok: true,
      profile: {
        id: ctx.profile.id,
        email: ctx.profile.email,
        full_name: ctx.profile.full_name,
        phone: ctx.profile.phone,
        hub_user_id: ctx.profile.hub_user_id,
      },
      subscription,
      entitlement_source,
      identity_authority: 'mbeuk_hub',
    });
  } catch (e) {
    if (e instanceof HubAuthError) return json({ error: e.message }, e.status);
    const safe = toSafeHubError(e);
    return json({ error: safe.message, code: safe.code }, safe.status || 502);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
