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

/** En-têtes CORS par défaut — restreint à APP_URL en production si défini. */
export const corsHeaders: Record<string, string> = (() => {
  const allowed = parseAllowedOrigins();
  const isProd = Deno.env.get('MBEUK_ENVIRONMENT') === 'production';
  const origin = allowed.length ? allowed[0] : (isProd ? 'null' : '*');
  return {
    'Access-Control-Allow-Origin': origin,
    ...(allowed.length ? { Vary: 'Origin' } : {}),
    ...BASE_HEADERS,
  };
})();

/** CORS dynamique selon l'en-tête Origin (préféré pour les handlers). */
export function corsHeadersFor(req: Request): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const origin = req.headers.get('Origin');
  const isProd = Deno.env.get('MBEUK_ENVIRONMENT') === 'production';

  if (!allowed.length) {
    return isProd
      ? { 'Access-Control-Allow-Origin': 'null', Vary: 'Origin', ...BASE_HEADERS }
      : { 'Access-Control-Allow-Origin': '*', ...BASE_HEADERS };
  }

  if (origin && allowed.includes(origin)) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', ...BASE_HEADERS };
  }

  return { 'Access-Control-Allow-Origin': allowed[0], Vary: 'Origin', ...BASE_HEADERS };
}
