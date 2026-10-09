// hub-auth-register — Inscription identité Hub (autorité) + profil métier SaaS local.
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  ensureHubConfigured,
  getHubClient,
  toSafeHubError,
  isSecurityDenial,
  isHubSchemaAccessTypeError,
  hubSchemaAccessTypeMessage,
  validateLicenseForUser,
  type LicenseVerifyResult,
} from '../_shared/hub-service.ts';
import { ensureSaasProfile, createBridgeSupabaseSession, ensureBridgeConfigured } from '../_shared/saas-profile.ts';
import { applyHubLicenseToUser } from '../_shared/subscription-sync.ts';
import { assertServiceRoleConfigured, jsonResponse } from '../_shared/edge-response.ts';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { hubLoginWithDeviceFallback } from '../_shared/hub-auth-helpers.ts';

function isDuplicateHubAccount(err: unknown): boolean {
  const safe = toSafeHubError(err);
  const msg = safe.message.toLowerCase();
  return (
    safe.code === 'USER_ALREADY_EXISTS'
    || safe.code === 'EMAIL_ALREADY_REGISTERED'
    || msg.includes('existe déjà')
    || msg.includes('already exists')
    || msg.includes('already registered')
  );
}

async function resolveHubLicense(
  hubLogin: { license?: LicenseVerifyResult },
  email: string,
  device_identifier?: string,
): Promise<LicenseVerifyResult> {
  if (hubLogin.license) return hubLogin.license;
  try {
    return await validateLicenseForUser({ email, device_identifier });
  } catch (e) {
    console.warn('[hub-auth-register] validateLicense failed', toSafeHubError(e).message);
    return { valid: false, reason: 'LICENSE_LOOKUP_FAILED', status: 'none' };
  }
}

async function ensureMinimalSubscription(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
) {
  await supabaseAdmin.from('subscriptions').upsert({
    user_id: userId,
    plan: 'trial',
    status: 'blocked',
    max_devices: 2,
    updated_at: new Date().toISOString(),
  });
}

function hubErrorResponse(safe: ReturnType<typeof toSafeHubError>, step: string, status?: number) {
  return jsonResponse({
    error: safe.message,
    code: safe.code,
    step,
    hub_details: safe.details ?? undefined,
  }, status ?? safe.status ?? 502);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    ensureHubConfigured();
    ensureBridgeConfigured();
    assertServiceRoleConfigured();

    const supabaseAdmin = createSupabaseAdmin();

    const { email, password, full_name, phone, device_identifier } = await req.json();
    if (!email || !password || String(password).length < 8) {
      return jsonResponse({ error: 'Email et mot de passe (8+ caractères) requis.' }, 400);
    }

    const rl = await checkRateLimit(supabaseAdmin, `hub-auth-register:${email.toLowerCase()}`);
    if (!rl.allowed) return jsonResponse({ error: 'Trop de tentatives.' }, 429);

    const hub = getHubClient();
    const productId = Deno.env.get('MBEUK_PRODUCT_ID')!;
    const emailNorm = String(email).trim();
    const passwordStr = String(password);

    let hubUserId: string;
    let hubEmail: string;
    let hubLogin;
    let recoveredExisting = false;

    try {
      const hubResult = await hub.auth.register({
        email: emailNorm,
        password: passwordStr,
        product_id: productId,
        device_identifier,
      });
      hubUserId = hubResult.user_id;
      hubEmail = hubResult.email;
      hubLogin = await hubLoginWithDeviceFallback(hub, {
        email: hubResult.email,
        password: passwordStr,
        product_id: productId,
        device_identifier,
      });
    } catch (registerErr) {
      if (isHubSchemaAccessTypeError(registerErr)) {
        return jsonResponse({ error: hubSchemaAccessTypeMessage(), code: 'HUB_SCHEMA_OUTDATED' }, 503);
      }
      if (!isDuplicateHubAccount(registerErr)) {
        return hubErrorResponse(toSafeHubError(registerErr), 'hub_register_or_login');
      }
      recoveredExisting = true;
      hubLogin = await hubLoginWithDeviceFallback(hub, {
        email: emailNorm,
        password: passwordStr,
        product_id: productId,
        device_identifier,
      });
      hubUserId = hubLogin.user_id;
      hubEmail = hubLogin.email;
    }

    const profile = await ensureSaasProfile(supabaseAdmin, {
      hub_user_id: hubUserId,
      email: hubEmail,
      full_name,
      phone,
      product_id: productId,
    });

    const license = await resolveHubLicense(hubLogin, hubEmail, device_identifier);

    try {
      await applyHubLicenseToUser(
        supabaseAdmin,
        profile.id,
        hubEmail,
        license,
        recoveredExisting ? 'hub_login' : 'hub_register',
      );
    } catch (syncErr) {
      console.error('[hub-auth-register] subscription sync failed', syncErr);
      await ensureMinimalSubscription(supabaseAdmin, profile.id);
    }

    const bridge = await createBridgeSupabaseSession(supabaseAdmin, hubUserId, hubEmail);

    return jsonResponse({
      ok: true,
      recovered_existing: recoveredExisting,
      hub_user_id: hubUserId,
      saas_user_id: profile.id,
      email: hubEmail,
      full_name: profile.full_name,
      hub_session_token: hubLogin.session_token,
      hub_refresh_token: hubLogin.refresh_token,
      hub_expires_at: hubLogin.expires_at,
      supabase_session: bridge,
      // L'identité peut être créée sans entitlement. Ne jamais convertir
      // l'absence du champ Hub en autorisation implicite.
      access_granted: hubLogin.access_granted === true && license.valid === true,
      license_valid: license.valid,
    });
  } catch (e) {
    const safe = toSafeHubError(e);
    if (isHubSchemaAccessTypeError(e)) {
      return jsonResponse({ error: hubSchemaAccessTypeMessage(), code: 'HUB_SCHEMA_OUTDATED' }, 503);
    }
    if (safe.message.includes('MBEUK_AUTH_BRIDGE_SECRET') || safe.message.includes('SUPABASE_AUTH_BRIDGE_SECRET')) {
      return jsonResponse({ error: safe.message, code: 'BRIDGE_SECRET_MISSING' }, 503);
    }
    if (safe.message.includes('service_role') || safe.message.includes('MBEUK_SERVICE_ROLE_KEY')) {
      return jsonResponse({ error: safe.message, code: 'SERVICE_ROLE_MISSING' }, 503);
    }
    const status = isSecurityDenial(safe.code) ? 403 : (safe.status || 502);
    return hubErrorResponse(safe, 'hub_auth_register', status);
  }
});
