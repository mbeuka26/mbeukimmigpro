const BASE_HEADERS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-hub-session-token, x-hub-refresh-token, x-hub-user-id, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('APP_URL')?.trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

/** Construit les en-têtes CORS (preflight + réponses JSON). */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const isProd = Deno.env.get('MBEUK_ENVIRONMENT') === 'production';

  if (origin) {
    if (allowed.length && allowed.includes(origin)) {
      return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', ...BASE_HEADERS };
    }
    if (!allowed.length) {
      if (!isProd || origin.startsWith('https://') || isLocalOrigin(origin)) {
        return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', ...BASE_HEADERS };
      }
    }
  }

  if (allowed.length) {
    return { 'Access-Control-Allow-Origin': allowed[0], Vary: 'Origin', ...BASE_HEADERS };
  }

  return { 'Access-Control-Allow-Origin': '*', ...BASE_HEADERS };
}

/** CORS dynamique selon l'en-tête Origin (handlers Edge). */
export function corsHeadersFor(req: Request): Record<string, string> {
  return buildCorsHeaders(req.headers.get('Origin'));
}

/** Fallback module (sans Origin) — évite `null` qui casse le navigateur. */
export const corsHeaders: Record<string, string> = buildCorsHeaders(null);
