import type { LLMProviderAdapter } from '../types.ts';
import { openaiAdapter } from './openai.ts';

/** xAI expose une API compatible OpenAI — base URL distincte */
export const xaiAdapter: LLMProviderAdapter = {
  id: 'xai',
  capabilities: {
    id: 'xai',
    supportsTools: false,
    supportsStreaming: true,
    defaultAuthHeader: 'bearer',
  },
  async chat(apiKey, params) {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
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
    if (!res.ok) throw new Error(data.error?.message || `xAI HTTP ${res.status}`);
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
      message: r.ok ? 'Connexion xAI réussie.' : r.message,
    }));
  },
};
