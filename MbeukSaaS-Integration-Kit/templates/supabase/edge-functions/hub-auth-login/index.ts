// hub-auth-login — Connexion identité Hub (autorité) + sync entitlement + pont RLS métier.
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  ensureHubConfigured,
  getHubClient,
  toSafeHubError,
  isSecurityDenial,
  isHubSchemaAccessTypeError,
  hubSchemaAccessTypeMessage,
} from '../_shared/hub-service.ts';
import { ensureSaasProfile, createBridgeSupabaseSession, ensureBridgeConfigured } from '../_shared/saas-profile.ts';
import { applyHubLicenseToUser } from '../_shared/subscription-sync.ts';
import { assertServiceRoleConfigured, jsonResponse } from '../_shared/edge-response.ts';
import { createSupabaseAdmin } from '../_shared/supabase-env.ts';
import { hubLoginWithDeviceFallback } from '../_shared/hub-auth-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    ensureHubConfigured();
    ensureBridgeConfigured();
    assertServiceRoleConfigured();

    const supabaseAdmin = createSupabaseAdmin();

    const { email, password, device_identifier } = await req.json();
    if (!email || !password) return jsonResponse({ error: 'Email et mot de passe requis.' }, 400);

    const rl = await checkRateLimit(supabaseAdmin, `hub-auth-login:${String(email).toLowerCase()}`);
    if (!rl.allowed) return jsonResponse({ error: 'Trop de tentatives.' }, 429);

    const hub = getHubClient();
    const productId = Deno.env.get('MBEUK_PRODUCT_ID')!;

    const hubLogin = await hubLoginWithDeviceFallback(hub, {
      email: String(email).trim(),
      password: String(password),
      product_id: productId,
      device_identifier,
    });

    if (hubLogin.access_granted === false && !hubLogin.session_token) {
      return jsonResponse({
        error: 'Quota appareils atteint. Contactez le support ou reconnectez-vous sans autre appareil actif.',
        code: 'DEVICE_LIMIT_REACHED',
        device_status: hubLogin.device_status,
      }, 403);
    }

    // Connexion identite autorisee meme si licence/appareil limites (essai ou achat ensuite)

    const profile = await ensureSaasProfile(supabaseAdmin, {
      hub_user_id: hubLogin.user_id,
      email: hubLogin.email,
      product_id: productId,
    });

    try {
      await applyHubLicenseToUser(
        supabaseAdmin,
        profile.id,
        hubLogin.email,
        hubLogin.license,
        hubLogin.license?.valid ? 'hub_login' : 'hub_denied',
      );
    } catch (syncErr) {
      console.error('[hub-auth-login] subscription sync failed', syncErr);
    }

    const bridge = await createBridgeSupabaseSession(supabaseAdmin, hubLogin.user_id, hubLogin.email);

    return jsonResponse({
      ok: true,
      hub_user_id: hubLogin.user_id,
      saas_user_id: profile.id,
      email: hubLogin.email,
      full_name: profile.full_name,
      hub_session_token: hubLogin.session_token,
      hub_refresh_token: hubLogin.refresh_token,
      hub_expires_at: hubLogin.expires_at,
      supabase_session: bridge,
      license_valid: hubLogin.license?.valid ?? false,
      access_granted:
        hubLogin.access_granted === true && hubLogin.license?.valid === true,
      device_status: hubLogin.device_status,
    });
  } catch (e) {
    if (isHubSchemaAccessTypeError(e)) {
      return jsonResponse({ error: hubSchemaAccessTypeMessage(), code: 'HUB_SCHEMA_OUTDATED' }, 503);
    }
    const safe = toSafeHubError(e);
    if (safe.code === 'ACCOUNT_NOT_FOUND') {
      return jsonResponse({
        error: 'Vérifiez votre email et mot de passe.',
        code: 'ACCOUNT_NOT_FOUND',
        step: 'hub_auth_login',
      }, 401);
    }
    if (safe.code === 'WRONG_PASSWORD') {
      return jsonResponse({
        error: 'Vérifiez votre mot de passe.',
        code: 'WRONG_PASSWORD',
        step: 'hub_auth_login',
      }, 401);
    }
    if (safe.code === 'UNAUTHORIZED') {
      return jsonResponse({
        error: 'Identifiant invalide. Vérifiez votre mot de passe.',
        code: 'INVALID_CREDENTIALS',
        step: 'hub_auth_login',
      }, 401);
    }
    if (safe.message.includes('MBEUK_AUTH_BRIDGE_SECRET') || safe.message.includes('SUPABASE_AUTH_BRIDGE_SECRET')) {
      return jsonResponse({ error: safe.message, code: 'BRIDGE_SECRET_MISSING' }, 503);
    }
    if (safe.message.includes('service_role') || safe.message.includes('MBEUK_SERVICE_ROLE_KEY')) {
      return jsonResponse({ error: safe.message, code: 'SERVICE_ROLE_MISSING' }, 503);
    }
    const status = isSecurityDenial(safe.code) ? 403 : (safe.status || 502);
    return jsonResponse({
      error: safe.message,
      code: safe.code,
      step: 'hub_auth_login',
      hub_details: safe.details ?? undefined,
    }, status);
  }
});
