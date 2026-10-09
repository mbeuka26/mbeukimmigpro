// hub-auth-forgot-password — Mot de passe oublié via Hub Central.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { ensureHubConfigured, getHubClient, toSafeHubError, isSecurityDenial } from '../_shared/hub-service.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    ensureHubConfigured();
    const supabaseAdmin = createSupabaseAdmin();

    const { email } = await req.json();
    if (!email) return json({ error: 'Email requis.' }, 400);

    const rl = await checkRateLimit(supabaseAdmin, `hub-forgot:${String(email).toLowerCase()}`);
    if (!rl.allowed) return json({ error: 'Trop de tentatives.' }, 429);

    const hub = getHubClient();
    const productId = Deno.env.get('MBEUK_PRODUCT_ID')!;

    const brevoKey = Deno.env.get('BREVO_API_KEY');
    const senderEmail = Deno.env.get('EMAIL_SENDER');
    const senderName = Deno.env.get('EMAIL_SENDER_NAME');

    const result = await hub.auth.forgotPassword({
      email: String(email).trim(),
      product_id: productId,
      brevo: brevoKey && senderEmail ? {
        apiKey: brevoKey,
        senderEmail,
        senderName: senderName ?? undefined,
      } : undefined,
    });

    return json({ ok: true, sent: result.sent, message: result.message });
  } catch (e) {
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
