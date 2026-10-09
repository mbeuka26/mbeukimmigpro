// hub-auth-refresh — Rafraîchit la session Hub + pont RLS métier.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { ensureHubConfigured, getHubClient, toSafeHubError } from '../_shared/hub-service.ts';
import { createBridgeSupabaseSession } from '../_shared/saas-profile.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    ensureHubConfigured();
    const supabaseAdmin = createSupabaseAdmin();

    const { refresh_token, hub_user_id, email } = await req.json();
    if (!refresh_token || !hub_user_id || !email) {
      return json({ error: 'refresh_token, hub_user_id et email requis.' }, 400);
    }

    const refreshed = await getHubClient().auth.refreshSession({ refresh_token });

    const bridge = await createBridgeSupabaseSession(supabaseAdmin, hub_user_id, email);

    return json({
      ok: true,
      hub_session_token: refreshed.session_token,
      hub_refresh_token: refreshed.refresh_token,
      hub_expires_at: refreshed.expires_at,
      supabase_session: bridge,
    });
  } catch (e) {
    const safe = toSafeHubError(e);
    return json({ error: safe.message, code: safe.code }, safe.status || 401);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
