// hub-validate-promo — Validation code influenceur via Hub Central (session Hub requise).
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  ensureHubConfigured,
  validateAffiliatePromoCode,
  toSafeHubError,
  isSecurityDenial,
} from '../_shared/hub-service.ts';
import { HubAuthError, requireHubAuth, saasUserId } from '../_shared/hub-session-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    ensureHubConfigured();
    const supabaseAdmin = createSupabaseAdmin();
    const ctx = await requireHubAuth(req, supabaseAdmin);
    const userId = saasUserId(ctx);

    const rl = await checkRateLimit(supabaseAdmin, `validate-promo:${userId}`);
    if (!rl.allowed) return json({ error: 'Trop de tentatives.' }, 429);

    const { promo_code } = await req.json().catch(() => ({}));
    const code = typeof promo_code === 'string' ? promo_code.trim() : '';
    if (!code) {
      return json({
        valid: false,
        reason: 'VALIDATION_ERROR',
        message: 'Code promo invalide. Vérifiez le code et réessayez.',
      }, 200);
    }

    const result = await validateAffiliatePromoCode(code);
    return json(
      {
        ...result,
        message:
          result.message ||
          (result.valid
            ? undefined
            : 'Code promo invalide. Vérifiez le code et réessayez.'),
      },
      200,
    );
  } catch (e) {
    if (e instanceof HubAuthError) return json({ error: e.message, code: 'HUB_AUTH' }, e.status);
    const safe = toSafeHubError(e);
    if (isSecurityDenial(safe.code)) {
      return json({ valid: false, error: safe.message, code: safe.code }, 403);
    }
    // Toujours 200 métier : l'UI reste sur la page promo (pas de faux « réseau »)
    return json({
      valid: false,
      reason: safe.code || 'PROMO_CHECK_FAILED',
      message: 'Impossible de vérifier le code promo. Réessayez dans un instant.',
      code: safe.code,
    }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
