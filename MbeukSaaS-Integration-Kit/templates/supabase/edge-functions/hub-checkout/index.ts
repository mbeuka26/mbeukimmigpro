// hub-checkout — Checkout Hub Central (session Hub requise).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  ensureHubConfigured,
  getHubClient,
  resolveAffiliate,
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

    const rl = await checkRateLimit(supabaseAdmin, `hub-checkout:${userId}`);
    if (!rl.allowed) return json({ error: 'Trop de tentatives.' }, 429);

    const { promo_code, link_ref } = await req.json().catch(() => ({}));
    const affiliateCode = resolveAffiliate({ manualCode: promo_code ?? null, linkRef: link_ref ?? null });

    const productId = Deno.env.get('MBEUK_PRODUCT_ID')!;

    const session = await getHubClient().checkout.create({
      customer_email: ctx.email,
      product_id: productId,
      promo_code: affiliateCode,
      link_ref: link_ref ?? undefined,
    });

    if (!session.checkout_url) {
      return json({
        error: 'Impossible de creer la session de paiement. Verifiez Chariow et le produit Hub.',
        code: 'NO_CHECKOUT_URL',
      }, 502);
    }

    try {
      await supabaseAdmin.from('license_history').insert({
        user_id: userId,
        event: 'checkout_started',
        details: {
          source: 'mbeuk_hub',
          sale_id: session.sale_id ?? null,
          affiliate_code: affiliateCode ?? null,
        },
      });
    } catch (histErr) {
      console.warn('[hub-checkout] license_history insert skipped', histErr);
    }

    return json({ ok: true, checkout_url: session.checkout_url, sale_id: session.sale_id ?? null });
  } catch (e) {
    if (e instanceof HubAuthError) return json({ error: e.message, code: 'HUB_AUTH' }, e.status);
    const safe = toSafeHubError(e);
    const status = isSecurityDenial(safe.code) ? 403 : (safe.status || 502);
    const message = safe.code === 'TIMEOUT'
      ? 'Le paiement Hub met trop de temps a repondre. Verifiez Chariow (cles, produit) dans l\'admin Hub Central, puis reessayez.'
      : safe.message;
    return json({
      error: message,
      code: safe.code,
      step: 'hub_checkout',
      hub_details: safe.details ?? undefined,
    }, status);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
