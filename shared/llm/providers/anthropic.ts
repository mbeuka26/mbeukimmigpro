import type { ChatParams, ChatResult, LLMProviderAdapter } from '../types.ts';

export const anthropicAdapter: LLMProviderAdapter = {
  id: 'anthropic',
  capabilities: {
    id: 'anthropic',
    supportsTools: true,
    supportsStreaming: true,
    defaultAuthHeader: 'x-api-key',
  },
  async chat(apiKey, params: ChatParams): Promise<ChatResult> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 1024,
        messages: params.messages.filter((m) => m.role !== 'system'),
        system: params.messages.find((m) => m.role === 'system')?.content,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Anthropic HTTP ${res.status}`);
    }
    const content = data.content?.map((c: { text?: string }) => c.text).join('') ?? '';
    return {
      content,
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
      raw: data,
    };
  },
  async testConnection(apiKey, model) {
    try {
      await this.chat(apiKey, {
        model,
        messages: [{ role: 'user', content: 'Reply OK' }],
        maxTokens: 5,
      });
      return { ok: true, message: 'Connexion Anthropic réussie.' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Erreur Anthropic' };
    }
  },
};
