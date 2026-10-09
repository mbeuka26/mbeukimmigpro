/**
 * Pont Supabase Auth technique — UNIQUEMENT pour RLS données métier.
 * L'autorité identité reste Hub Central ; l'utilisateur ne se connecte jamais directement ici.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sha256Hex } from './crypto.ts';
import { getAnonKey, getServiceRoleKey } from './supabase-env.ts';

const BRIDGE_SECRET_ENV = 'MBEUK_AUTH_BRIDGE_SECRET';
const LEGACY_BRIDGE_SECRET_ENV = 'SUPABASE_AUTH_BRIDGE_SECRET';

function readBridgeSecretRaw(): string | undefined {
  return Deno.env.get(BRIDGE_SECRET_ENV)?.trim()
    || Deno.env.get(LEGACY_BRIDGE_SECRET_ENV)?.trim()
    || undefined;
}

/** Vérifie la config pont RLS avant tout appel Hub (évite compte Hub orphelin). */
export function ensureBridgeConfigured(): void {
  const secret = readBridgeSecretRaw();
  if (!secret || secret.length < 32) {
    throw new Error(
      `${BRIDGE_SECRET_ENV} manquant ou trop court (32+ caractères). ` +
      'Ajoutez ce secret dans Supabase Edge Functions (sans préfixe SUPABASE_) puis redeployez.',
    );
  }
}

function bridgeSecret(): string {
  ensureBridgeConfigured();
  return readBridgeSecretRaw()!;
}

/** Mot de passe interne déterministe — jamais exposé à l'utilisateur. */
export async function deriveBridgePassword(hubUserId: string): Promise<string> {
  return sha256Hex(`${bridgeSecret()}:${hubUserId}:mbeuk-bridge-v1`);
}

export type SaasProfile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  hub_user_id: string;
  hub_email: string | null;
  hub_product_id: string | null;
};

/** Crée ou met à jour le profil métier SaaS + miroir auth technique Supabase. */
export async function ensureSaasProfile(
  supabaseAdmin: SupabaseClient,
  input: {
    hub_user_id: string;
    email: string;
    full_name?: string;
    phone?: string | null;
    product_id?: string;
  },
): Promise<SaasProfile> {
  const email = input.email.trim().toLowerCase();
  const productId = input.product_id ?? Deno.env.get('MBEUK_PRODUCT_ID') ?? null;

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('hub_user_id', input.hub_user_id)
    .maybeSingle();

  // Préserver le full_name existant si le login ne le renvoie pas (évite d'écraser "Jean Dupont" par "jean").
  const fullName =
    input.full_name?.trim() ||
    (typeof existing?.full_name === 'string' ? existing.full_name.trim() : '') ||
    email.split('@')[0];

  if (existing) {
    const { error: updateErr } = await supabaseAdmin.from('profiles').update({
      email,
      hub_email: email,
      full_name: fullName,
      phone: input.phone ?? existing.phone,
      hub_product_id: productId,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
    if (updateErr) {
      throw new Error(`profiles update: ${updateErr.message}. Migrations MbeukAgri 000005/000007 requises.`);
    }
    await ensureBridgeAuthUser(supabaseAdmin, existing.id, email, input.hub_user_id);
    return { ...existing, email, full_name: fullName, hub_user_id: input.hub_user_id };
  }

  const bridgePassword = await deriveBridgePassword(input.hub_user_id);
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: bridgePassword,
    email_confirm: true,
    user_metadata: {
      hub_user_id: input.hub_user_id,
      auth_bridge: true,
      identity_authority: 'mbeuk_hub',
    },
  });

  if (authErr && !String(authErr.message).includes('already been registered')) {
    throw authErr;
  }

  let profileId = authUser?.user?.id;
  if (!profileId) {
    const { data: listed } = await supabaseAdmin.auth.admin.listUsers();
    profileId = listed?.users?.find((u) => u.email?.toLowerCase() === email)?.id;
  }
  if (!profileId) throw new Error('Impossible de créer le profil métier SaaS.');

  const { error: upsertErr } = await supabaseAdmin.from('profiles').upsert({
    id: profileId,
    email,
    full_name: fullName,
    phone: input.phone ?? null,
    hub_user_id: input.hub_user_id,
    hub_email: email,
    hub_product_id: productId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (upsertErr) {
    throw new Error(`profiles upsert: ${upsertErr.message}. Migrations MbeukAgri 000005/000007 requises.`);
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();
  if (profileErr || !profile) {
    throw new Error(`Profil SaaS introuvable: ${profileErr?.message ?? 'inconnu'}`);
  }
  return profile as SaasProfile;
}

async function ensureBridgeAuthUser(
  supabaseAdmin: SupabaseClient,
  profileId: string,
  email: string,
  hubUserId: string,
) {
  const bridgePassword = await deriveBridgePassword(hubUserId);
  const { data: listed } = await supabaseAdmin.auth.admin.listUsers();
  const exists = listed?.users?.some((u) => u.id === profileId || u.email?.toLowerCase() === email.toLowerCase());
  if (!exists) {
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: bridgePassword,
      email_confirm: true,
      user_metadata: { hub_user_id: hubUserId, auth_bridge: true, identity_authority: 'mbeuk_hub' },
    });
  } else {
    await supabaseAdmin.auth.admin.updateUserById(profileId, {
      password: bridgePassword,
      user_metadata: { hub_user_id: hubUserId, auth_bridge: true, identity_authority: 'mbeuk_hub' },
    });
  }
}

/** Session Supabase technique pour accès RLS aux données métier (cloud_business_data, etc.). */
export async function createBridgeSupabaseSession(
  supabaseAdmin: SupabaseClient,
  hubUserId: string,
  email: string,
): Promise<{ access_token: string; refresh_token: string; expires_at?: number } | null> {
  const bridgePassword = await deriveBridgePassword(hubUserId);
  const anon = Deno.env.get('SUPABASE_URL');
  const serviceKey = getServiceRoleKey();
  const anonKey = getAnonKey() || serviceKey;
  if (!anon || !serviceKey) return null;

  const res = await fetch(`${anon}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ email, password: bridgePassword }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('[saas-profile] bridge session failed', email, json);
    return null;
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: json.expires_at,
  };
}
