import { LLMProvider } from '../types';

export interface ProviderInfo {
  id: LLMProvider;
  label: string;
  color: string;
  defaultModels: string[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    color: '#10a37f',
    defaultModels: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    color: '#d97757',
    defaultModels: [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    color: '#4285f4',
    defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    color: '#ff7000',
    defaultModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
  },
  {
    id: 'cohere',
    label: 'Cohere',
    color: '#39594d',
    defaultModels: ['command-r-plus', 'command-r', 'command'],
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    color: '#7c3aed',
    defaultModels: [],
  },
];

/** Accent colours keyed by provider — derived from PROVIDERS to avoid duplication */
export const PROVIDER_COLORS: Record<LLMProvider, string> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.color])
) as Record<LLMProvider, string>;

/** Accent colours used to distinguish multiple LLMs within a session */
export const LLM_ACCENT_COLORS = [
  '#10a37f',
  '#d97757',
  '#4285f4',
  '#ff7000',
  '#39594d',
  '#7c3aed',
  '#e11d48',
  '#0891b2',
  '#ca8a04',
  '#16a34a',
];

export function getProviderInfo(provider: LLMProvider): ProviderInfo {
  return PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[PROVIDERS.length - 1];
}
