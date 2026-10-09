// hub-sync-license — Sync entitlement Hub post-paiement (session Hub requise).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  ensureHubConfigured,
  syncLicenseForUser,
  validateLicenseForUser,
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

    const rl = await checkRateLimit(supabaseAdmin, `hub-sync:${userId}`);
    if (!rl.allowed) return json({ error: 'Trop de tentatives.' }, 429);

    const { device_identifier } = await req.json().catch(() => ({}));

    // sync legacy peut echouer (mapping) — validate reste la source d'entitlement.
    try {
      await syncLicenseForUser({ email: ctx.email, device_identifier });
    } catch (syncErr) {
      console.warn('[hub-sync-license] sync soft-fail, continue validate', syncErr);
    }
    const hubResult = await validateLicenseForUser({ email: ctx.email, device_identifier });
    const subscription = await applyHubLicenseToUser(
      supabaseAdmin, userId, ctx.email, hubResult,
      hubResult.valid ? 'hub_sync' : 'hub_sync_pending',
    );

    return json({
      ok: true,
      valid: hubResult.valid,
      reason: hubResult.reason ?? null,
      subscription,
      message: hubResult.valid
        ? 'Accès confirmé par Hub Central.'
        : String(hubResult.reason ?? '').toUpperCase().includes('PENDING')
          ? 'Paiement en cours de confirmation.'
          : 'Compte connecté, mais aucune licence active. Achetez une licence ou démarrez l’essai gratuit.',
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
