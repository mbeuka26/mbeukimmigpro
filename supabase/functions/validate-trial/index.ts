// validate-trial — Essai via Hub Central (session Hub requise).
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  ensureHubConfigured,
  toSafeHubError,
  isSecurityDenial,
  isHubSchemaAccessTypeError,
  hubSchemaAccessTypeMessage,
  startTrialWithFallback,
  trialFailureMessage,
  resolveHubLicenseForUser,
  syncLicenseForUser,
} from '../_shared/hub-service.ts';
import { HubAuthError, requireHubAuth, saasUserId } from '../_shared/hub-session-auth.ts';
import { applyHubLicenseToUser } from '../_shared/subscription-sync.ts';

function hubFail(safe: ReturnType<typeof toSafeHubError>, status?: number) {
  const code = safe.code === 'HTTP_ERROR' ? 'TRIAL_FAILED' : safe.code;
  const message = code === 'TRIAL_FAILED' || safe.code === 'HTTP_ERROR'
    ? trialFailureMessage(safe)
    : (trialFailureMessage(safe) || safe.message);
  return json({
    error: message,
    code,
    step: 'validate_trial',
    hub_details: safe.details ?? undefined,
  }, status ?? safe.status ?? 502);
}

async function resolveLicenseAfterTrial(email: string, device_identifier: string) {
  let hubResult = await resolveHubLicenseForUser({ email, device_identifier });
  if (hubResult.valid) return hubResult;

  const reason = (hubResult.reason ?? '').toUpperCase();
  if (reason.includes('NOT_FOUND') || reason.includes('NO_LICENSE')) {
    try {
      await syncLicenseForUser({ email, device_identifier });
      hubResult = await resolveHubLicenseForUser({ email, device_identifier });
      if (hubResult.valid) return hubResult;
    } catch (syncErr) {
      console.warn('[validate-trial] sync retry failed', syncErr);
    }
  }
  return hubResult;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    ensureHubConfigured();
    const supabaseAdmin = createSupabaseAdmin();

    const ctx = await requireHubAuth(req, supabaseAdmin);
    const userId = saasUserId(ctx);

    const rl = await checkRateLimit(supabaseAdmin, `trial:${userId}`);
    if (!rl.allowed) return json({ error: 'Trop de tentatives.' }, 429);

    const { device_id, fingerprint_hash, local_device_id } = await req.json().catch(() => ({}));
    if (!fingerprint_hash && !device_id) {
      return json({ error: 'Empreinte appareil requise' }, 400);
    }

    const device_identifier = String(fingerprint_hash || device_id);
    const saasDeviceId = String(local_device_id || device_id || device_identifier);
    const productId = Deno.env.get('MBEUK_PRODUCT_ID')!;

    await startTrialWithFallback({
      email: ctx.email,
      product_id: productId,
      user_id: ctx.hub_user_id,
      device_identifier,
      device_id: device_identifier,
    });

    const hubResult = await resolveLicenseAfterTrial(ctx.email, device_identifier);
    if (!hubResult.valid) {
      const reason = hubResult.reason || 'TRIAL_FAILED';
      const safe = toSafeHubError(new Error(hubResult.message || reason));
      return hubFail({ ...safe, code: reason, message: trialFailureMessage({ ...safe, code: reason }) });
    }

    const subscription = await applyHubLicenseToUser(
      supabaseAdmin, userId, ctx.email, hubResult, 'trial_started',
    );

    const now = new Date();
    const expiresAt = subscription.trial_ends_at ?? subscription.expires_at;

    await supabaseAdmin.from('trial_registry').upsert({
      fingerprint_hash: device_identifier,
      user_id: userId,
      started_at: now.toISOString(),
      expires_at: expiresAt ?? new Date(now.getTime() + 3 * 86400000).toISOString(),
    });

    await supabaseAdmin.from('devices').upsert({
      user_id: userId,
      device_id: saasDeviceId,
      fingerprint_hash: device_identifier,
      trust_score: 100,
      last_seen: now.toISOString(),
      is_trusted: true,
    }, { onConflict: 'user_id,device_id' });

    return json({ ok: true, trial_ends_at: expiresAt, valid: hubResult.valid });
  } catch (e) {
    if (e instanceof HubAuthError) return json({ error: e.message, code: 'HUB_AUTH' }, e.status);
    if (isHubSchemaAccessTypeError(e)) {
      return json({ error: hubSchemaAccessTypeMessage(), code: 'HUB_SCHEMA_OUTDATED' }, 503);
    }
    const safe = toSafeHubError(e);
    const status = isSecurityDenial(safe.code) ? 403 : (safe.status || 502);
    return hubFail(safe, status);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
