// _shared/rate-limit.ts
// Rate limiting simple basé sur une table Supabase (pas de dépendance externe
// type Redis — suffisant pour la volumétrie d'un ERP agricole SaaS).
// Utilisation : appeler checkRateLimit AVANT toute logique sensible
// (validation de licence, essai gratuit) pour bloquer le brute-force.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

export type RateLimitOptions = {
  /** Tentatives max dans la fenêtre (défaut 8 auth ; plus haut pour sync/poll). */
  maxAttempts?: number;
  /** Fenêtre glissante en secondes (défaut 300 = 5 min). */
  windowSeconds?: number;
};

const DEFAULT_WINDOW_SECONDS = 300;
const DEFAULT_MAX_ATTEMPTS = 8;

/**
 * @param supabaseAdmin client Supabase avec la service role key
 * @param bucketKey identifiant unique de la limite (ex: `license:<ip>` ou `hub-sync:<userId>`)
 * @param options maxAttempts / windowSeconds optionnels
 */
export async function checkRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucketKey: string,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const now = Date.now();
  const windowStart = new Date(now - windowSeconds * 1000).toISOString();

  const { count, error: countErr } = await supabaseAdmin
    .from('rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('bucket_key', bucketKey)
    .gte('created_at', windowStart);

  if (countErr) {
    console.warn('[rate-limit] table indisponible, skip:', countErr.message);
    return { allowed: true, remaining: maxAttempts };
  }

  if ((count ?? 0) >= maxAttempts) {
    return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
  }

  await supabaseAdmin.from('rate_limit_log').insert({ bucket_key: bucketKey });

  return { allowed: true, remaining: maxAttempts - (count ?? 0) - 1 };
}
