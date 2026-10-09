import { decryptApiKey, encryptApiKey } from '../../../shared/crypto/byok.ts';
import { getProvider } from '../../../shared/llm/registry.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(req);
    const body = await req.json();
    const action = body.action as string;
    const master = Deno.env.get('BYOK_MASTER_KEY_BASE64');
    const db = serviceClient();

    if (action === 'save') {
      if (!master) return errorResponse('BYOK_DISABLED', 'Enregistrement BYOK indisponible (clé maître serveur absente).', 503);
      const { providerId, apiKey } = body;
      if (!providerId || !apiKey || typeof apiKey !== 'string') {
        return errorResponse('INVALID_INPUT', 'providerId et apiKey requis.');
      }
      const enc = await encryptApiKey(apiKey, master);
      const { error } = await db.from('byok_credentials').upsert({
        user_id: user.id,
        provider_id: providerId,
        key_hint: enc.hint,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider_id' });
      if (error) return errorResponse('DB_ERROR', error.message, 500);
      return jsonResponse({ ok: true, hint: enc.hint });
    }

    if (action === 'test') {
      if (!master) return errorResponse('BYOK_DISABLED', 'Test BYOK indisponible.', 503);
      const { providerId, modelId, apiKey } = body;
      let key = apiKey as string | undefined;
      if (!key) {
        const { data } = await db.from('byok_credentials').select('ciphertext, iv').eq('user_id', user.id).eq('provider_id', providerId).maybeSingle();
        if (!data) return errorResponse('NOT_FOUND', 'Aucune clé enregistrée pour ce fournisseur.');
        key = await decryptApiKey(data.ciphertext as string, data.iv as string, master);
      }
      const provider = getProvider(providerId);
      const test = await provider.testConnection(key, modelId || 'gpt-4o-mini');
      await db.from('byok_credentials').update({
        last_tested_at: new Date().toISOString(),
        last_test_ok: test.ok,
      }).eq('user_id', user.id).eq('provider_id', providerId);
      return jsonResponse(test);
    }

    if (action === 'delete') {
      await db.from('byok_credentials').delete().eq('user_id', user.id).eq('provider_id', body.providerId);
      return jsonResponse({ ok: true });
    }

    if (action === 'status') {
      const { data } = await db.from('byok_credentials').select('provider_id, key_hint, last_tested_at, last_test_ok, updated_at').eq('user_id', user.id);
      const { data: settings } = await db.from('user_ai_settings').select('*').eq('user_id', user.id).maybeSingle();
      return jsonResponse({ credentials: data ?? [], settings });
    }

    if (action === 'set_mode') {
      const { mode, defaultProviderId, defaultModelId } = body;
      if (!['central', 'byok'].includes(mode)) return errorResponse('INVALID_INPUT', 'mode invalide');
      await db.from('user_ai_settings').upsert({
        user_id: user.id,
        mode,
        default_provider_id: defaultProviderId ?? null,
        default_model_id: defaultModelId ?? null,
        updated_at: new Date().toISOString(),
      });
      return jsonResponse({ ok: true });
    }

    return errorResponse('UNKNOWN_ACTION', 'Action inconnue');
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return errorResponse('UNAUTHORIZED', 'Authentification requise.', 401);
    }
    return errorResponse('INTERNAL', e instanceof Error ? e.message : 'Erreur interne', 500);
  }
});
