import { describe, expect, it } from 'vitest';
import { getProvider, listProviders, PROVIDER_CONSOLE_URLS } from '../shared/llm/registry.ts';

describe('LLM registry', () => {
  it('lists six providers', () => {
    expect(listProviders().length).toBe(6);
  });

  it('resolves adapters', () => {
    expect(getProvider('openai').id).toBe('openai');
    expect(getProvider('mistral').id).toBe('mistral');
  });

  it('has console urls', () => {
    expect(PROVIDER_CONSOLE_URLS.openai).toMatch(/^https:\/\//);
  });
});
