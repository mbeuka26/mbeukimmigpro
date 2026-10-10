// hub-ping — Santé publique Edge (sans secret admin), pour PWA / health-check kit.
import { corsHeaders } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/edge-response.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return jsonResponse({ ok: true, service: 'mbeukimmig-hub-edge' });
});
