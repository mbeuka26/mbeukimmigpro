const BASE_HEADERS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-hub-session-token, x-hub-refresh-token, x-hub-user-id, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('APP_URL')?.trim();
  if (!raw) return [];
  return raw.split(',').map((s) => normalizeOrigin(s)).filter(Boolean);
}

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function originAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  const norm = normalizeOrigin(origin);
  return allowed.some((a) => a === norm);
}

/** Construit les en-têtes CORS (preflight + réponses JSON). */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const isProd = Deno.env.get('MBEUK_ENVIRONMENT') === 'production';

  if (origin) {
    if (allowed.length && originAllowed(origin, allowed)) {
      return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', ...BASE_HEADERS };
    }
    if (!allowed.length) {
      if (!isProd || origin.startsWith('https://') || isLocalOrigin(origin)) {
        return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', ...BASE_HEADERS };
      }
    }
  }

  if (allowed.length) {
    const first = Deno.env.get('APP_URL')!.split(',')[0].trim().replace(/\/+$/, '');
    return { 'Access-Control-Allow-Origin': first, Vary: 'Origin', ...BASE_HEADERS };
  }

  return { 'Access-Control-Allow-Origin': '*', ...BASE_HEADERS };
}

/** CORS dynamique selon l'en-tête Origin (handlers Edge). */
export function corsHeadersFor(req: Request): Record<string, string> {
  return buildCorsHeaders(req.headers.get('Origin'));
}

/** Fallback module (sans Origin) — évite `null` qui casse le navigateur. */
export const corsHeaders: Record<string, string> = buildCorsHeaders(null);
