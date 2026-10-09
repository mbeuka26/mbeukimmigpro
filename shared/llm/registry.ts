import type { LLMProviderAdapter, ProviderId } from './types.ts';
import { anthropicAdapter } from './providers/anthropic.ts';
import { googleAdapter } from './providers/google.ts';
import { mistralAdapter } from './providers/mistral.ts';
import { openaiAdapter } from './providers/openai.ts';
import { openrouterAdapter } from './providers/openrouter.ts';
import { xaiAdapter } from './providers/xai.ts';

const REGISTRY: Record<ProviderId, LLMProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  xai: xaiAdapter,
  openrouter: openrouterAdapter,
  mistral: mistralAdapter,
};

export function getProvider(id: string): LLMProviderAdapter {
  const adapter = REGISTRY[id as ProviderId];
  if (!adapter) throw new Error(`Fournisseur non supporté: ${id}`);
  return adapter;
}

export function listProviders(): ProviderId[] {
  return Object.keys(REGISTRY) as ProviderId[];
}

export const PROVIDER_CONSOLE_URLS: Record<ProviderId, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/',
  google: 'https://aistudio.google.com/apikey',
  xai: 'https://console.x.ai/',
  openrouter: 'https://openrouter.ai/settings/keys',
  mistral: 'https://console.mistral.ai/',
};
