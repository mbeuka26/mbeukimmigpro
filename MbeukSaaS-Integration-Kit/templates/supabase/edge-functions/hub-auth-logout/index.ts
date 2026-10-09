// hub-auth-logout — Déconnexion Hub Central.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { ensureHubConfigured, getHubClient, toSafeHubError } from '../_shared/hub-service.ts';
import { HubAuthError, requireHubAuth } from '../_shared/hub-session-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    ensureHubConfigured();
    const supabaseAdmin = createSupabaseAdmin();

    const ctx = await requireHubAuth(req, supabaseAdmin);
    await getHubClient().auth.logout({ session_token: ctx.hub_session_token });

    return json({ ok: true, logged_out: true });
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
