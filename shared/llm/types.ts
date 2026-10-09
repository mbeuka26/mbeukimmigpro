export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'openrouter'
  | 'mistral';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  raw?: unknown;
}

export interface ProviderCapabilities {
  id: ProviderId;
  supportsTools: boolean;
  supportsStreaming: boolean;
  defaultAuthHeader: 'bearer' | 'x-api-key' | 'google-api-key';
}

export interface LLMProviderAdapter {
  id: ProviderId;
  capabilities: ProviderCapabilities;
  chat(apiKey: string, params: ChatParams): Promise<ChatResult>;
  testConnection(apiKey: string, model: string): Promise<{ ok: boolean; message: string }>;
}
