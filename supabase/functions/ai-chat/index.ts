import { decryptApiKey } from '../../../shared/crypto/byok.ts';
import { getProvider } from '../../../shared/llm/registry.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

function centralKey(providerId: string): string | undefined {
  const map: Record<string, string> = {
    openai: 'CENTRAL_OPENAI_API_KEY',
    anthropic: 'CENTRAL_ANTHROPIC_API_KEY',
    google: 'CENTRAL_GOOGLE_API_KEY',
    xai: 'CENTRAL_XAI_API_KEY',
    openrouter: 'CENTRAL_OPENROUTER_API_KEY',
    mistral: 'CENTRAL_MISTRAL_API_KEY',
  };
  const env = map[providerId];
  return env ? Deno.env.get(env) : undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(req);
    const { messages, providerId, modelId, allowCentralFallback } = await req.json();
    const db = serviceClient();

    const { data: settings } = await db.from('user_ai_settings').select('*').eq('user_id', user.id).maybeSingle();
    const mode = settings?.mode ?? 'central';
    const provider = providerId || settings?.default_provider_id;
    const model = modelId || settings?.default_model_id;
    if (!provider || !model) return errorResponse('CONFIG_MISSING', 'Fournisseur ou modèle non configuré.');

    let billingMode: 'central' | 'byok' = mode;
    let apiKey: string | undefined;

    if (mode === 'byok') {
      const master = Deno.env.get('BYOK_MASTER_KEY_BASE64');
      if (!master) return errorResponse('BYOK_DISABLED', 'Mode BYOK indisponible.', 503);
      const { data: cred } = await db.from('byok_credentials').select('ciphertext, iv').eq('user_id', user.id).eq('provider_id', provider).maybeSingle();
      if (!cred) {
        if (allowCentralFallback) billingMode = 'central';
        else return errorResponse('BYOK_MISSING', 'Clé personnelle absente — pas de basculement silencieux.', 402);
      } else {
        apiKey = await decryptApiKey(cred.ciphertext as string, cred.iv as string, master);
      }
    }

    if (billingMode === 'central') {
      const { data: central } = await db.from('central_ai_config').select('enabled').eq('id', 1).maybeSingle();
      if (!central?.enabled) {
        return errorResponse('CENTRAL_DISABLED', 'IA centrale désactivée. Connectez une clé personnelle (BYOK).', 503);
      }
      const reserved = await db.rpc('reserve_central_quota', { p_user_id: user.id, p_tokens_estimate: 1000 });
      if (reserved.error || reserved.data === false) {
        return errorResponse('QUOTA_EXCEEDED', 'Quota central épuisé ou dépassé.', 429);
      }
      apiKey = centralKey(provider);
      if (!apiKey) return errorResponse('CENTRAL_KEY_MISSING', `Clé centrale absente pour ${provider}.`, 503);
    }

    const adapter = getProvider(provider);
    const result = await adapter.chat(apiKey!, {
      model,
      messages: messages ?? [],
      maxTokens: 2048,
    });

    if (billingMode === 'central') {
      await db.rpc('record_token_usage', {
        p_user_id: user.id,
        p_tokens_in: result.tokensIn,
        p_tokens_out: result.tokensOut,
        p_cost_cents: 0,
      });
    }

    await db.from('llm_usage_logs').insert({
      user_id: user.id,
      billing_mode: billingMode,
      provider_id: provider,
      model_id: model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      success: true,
    });

    return jsonResponse({
      content: result.content,
      billingMode,
      provider,
      model,
      usage: { tokensIn: result.tokensIn, tokensOut: result.tokensOut },
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return errorResponse('UNAUTHORIZED', 'Authentification requise.', 401);
    }
    const msg = e instanceof Error ? e.message : 'Erreur';
    return errorResponse('PROVIDER_ERROR', msg, 502);
  }
});
