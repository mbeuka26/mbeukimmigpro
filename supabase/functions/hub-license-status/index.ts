// hub-license-status — Statut entitlement Hub pour session Hub authentifiée.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  ensureHubConfigured,
  resolveHubLicenseForUser,
  toSafeHubError,
  isSecurityDenial,
} from '../_shared/hub-service.ts';
import { HubAuthError, requireHubAuth, saasUserId } from '../_shared/hub-session-auth.ts';
import { applyHubLicenseToUser } from '../_shared/subscription-sync.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    ensureHubConfigured();
    const supabaseAdmin = createSupabaseAdmin();

    const ctx = await requireHubAuth(req, supabaseAdmin);
    const userId = saasUserId(ctx);

    const rl = await checkRateLimit(supabaseAdmin, `hub-status:${userId}`);
    if (!rl.allowed) return json({ error: 'Trop de tentatives.' }, 429);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const hubResult = await resolveHubLicenseForUser({
      email: ctx.email,
      device_identifier: body.device_identifier,
    });

    const subscription = await applyHubLicenseToUser(
      supabaseAdmin, userId, ctx.email, hubResult,
      hubResult.valid || hubResult.license?.id ? 'hub_sync' : 'hub_denied',
    );

    return json({
      ok: true,
      valid: hubResult.valid,
      reason: hubResult.reason ?? null,
      subscription,
      expiration_date: hubResult.expiration_date ?? hubResult.license?.expiration_date ?? null,
    });
  } catch (e) {
    if (e instanceof HubAuthError) return json({ error: e.message }, e.status);
    const safe = toSafeHubError(e);
    const status = isSecurityDenial(safe.code) ? 403 : (safe.status || 502);
    return json({ error: safe.message, code: safe.code }, status);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
