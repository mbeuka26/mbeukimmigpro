/**
 * Clés Supabase pour Edge Functions.
 * Supabase interdit les secrets manuels préfixés SUPABASE_* (réservés / injectés).
 * Utilisez MBEUK_SERVICE_ROLE_KEY dans le dashboard Secrets si besoin d'un override explicite.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getServiceRoleKey(): string {
  return (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    || Deno.env.get('MBEUK_SERVICE_ROLE_KEY')?.trim()
    || ''
  );
}

export function getAnonKey(): string {
  return (
    Deno.env.get('SUPABASE_ANON_KEY')?.trim()
    || Deno.env.get('MBEUK_ANON_KEY')?.trim()
    || ''
  );
}

export function assertServiceRoleConfigured(): void {
  if (!getServiceRoleKey()) {
    throw new Error(
      'Clé service_role manquante. Supabase l injecte souvent automatiquement (SUPABASE_SERVICE_ROLE_KEY). ' +
      'Sinon ajoutez le secret MBEUK_SERVICE_ROLE_KEY (Settings → API → service_role). ' +
      'Ne pas créer de secret SUPABASE_* dans le dashboard — préfixe interdit.',
    );
  }
}

export function createSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = getServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      'Supabase admin indisponible. Verifiez SUPABASE_URL et MBEUK_SERVICE_ROLE_KEY (ou injection auto service_role).',
    );
  }
  return createClient(url, key);
}
