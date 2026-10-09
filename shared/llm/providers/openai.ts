import type { ChatParams, ChatResult, LLMProviderAdapter } from '../types.ts';

export const openaiAdapter: LLMProviderAdapter = {
  id: 'openai',
  capabilities: {
    id: 'openai',
    supportsTools: true,
    supportsStreaming: true,
    defaultAuthHeader: 'bearer',
  },
  async chat(apiKey, params: ChatParams): Promise<ChatResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.3,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    return {
      content,
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      raw: data,
    };
  },
  async testConnection(apiKey, model) {
    try {
      await this.chat(apiKey, {
        model,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
        maxTokens: 5,
      });
      return { ok: true, message: 'Connexion OpenAI réussie.' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Erreur OpenAI' };
    }
  },
};
