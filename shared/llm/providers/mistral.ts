import type { ChatParams, ChatResult, LLMProviderAdapter } from '../types.ts';

export const mistralAdapter: LLMProviderAdapter = {
  id: 'mistral',
  capabilities: {
    id: 'mistral',
    supportsTools: true,
    supportsStreaming: true,
    defaultAuthHeader: 'bearer',
  },
  async chat(apiKey, params: ChatParams): Promise<ChatResult> {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens ?? 1024,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Mistral HTTP ${res.status}`);
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      raw: data,
    };
  },
  async testConnection(apiKey, model) {
    try {
      await this.chat(apiKey, { model, messages: [{ role: 'user', content: 'OK' }], maxTokens: 5 });
      return { ok: true, message: 'Connexion Mistral réussie.' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Erreur Mistral' };
    }
  },
};
