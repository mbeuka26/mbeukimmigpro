import type { ChatParams, ChatResult, LLMProviderAdapter } from '../types.ts';

export const googleAdapter: LLMProviderAdapter = {
  id: 'google',
  capabilities: {
    id: 'google',
    supportsTools: true,
    supportsStreaming: true,
    defaultAuthHeader: 'google-api-key',
  },
  async chat(apiKey, params: ChatParams): Promise<ChatResult> {
    const model = params.model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: params.messages.map((m) => `${m.role}: ${m.content}`).join('\n') }] }],
        generationConfig: { maxOutputTokens: params.maxTokens ?? 1024, temperature: params.temperature ?? 0.3 },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
    }
    const content = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ?? '';
    return { content, tokensIn: 0, tokensOut: 0, raw: data };
  },
  async testConnection(apiKey, model) {
    try {
      await this.chat(apiKey, { model, messages: [{ role: 'user', content: 'OK' }], maxTokens: 5 });
      return { ok: true, message: 'Connexion Gemini réussie.' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Erreur Gemini' };
    }
  },
};
