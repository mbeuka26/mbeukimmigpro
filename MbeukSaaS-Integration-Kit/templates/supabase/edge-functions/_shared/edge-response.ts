import { corsHeaders } from './cors.ts';
import { assertServiceRoleConfigured } from './supabase-env.ts';

export { assertServiceRoleConfigured };

export function jsonResponse(body: unknown, status = 200): Response {
  try {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: 'Reponse serveur invalide.',
      code: 'JSON_SERIALIZE_ERROR',
      detail: e instanceof Error ? e.message : String(e),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export function fatalErrorResponse(err: unknown, step: string): Response {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${step}]`, err);
  return jsonResponse({ error: message, code: 'EDGE_FUNCTION_ERROR', step }, 500);
}

