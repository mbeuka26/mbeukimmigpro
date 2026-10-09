import type { LLMProviderAdapter } from '../types.ts';
import { openaiAdapter } from './openai.ts';

export const openrouterAdapter: LLMProviderAdapter = {
  id: 'openrouter',
  capabilities: {
    id: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
    defaultAuthHeader: 'bearer',
  },
  async chat(apiKey, params) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mbeukimmig.local',
        'X-Title': 'MbeukImmig Pro',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens ?? 1024,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `OpenRouter HTTP ${res.status}`);
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      raw: data,
    };
  },
  testConnection(apiKey, model) {
    return openaiAdapter.testConnection(apiKey, model).then((r) => ({
      ...r,
      message: r.ok ? 'Connexion OpenRouter réussie.' : r.message,
    }));
  },
};
