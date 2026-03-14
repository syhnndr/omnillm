// ─────────────────────────────────────────────
// LLM Provider types
// ─────────────────────────────────────────────

export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'cohere'
  | 'custom';

/** A saved API key / LLM configuration stored on device */
export interface SavedLLM {
  id: string;
  displayName: string;
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

// ─────────────────────────────────────────────
// Session types
// ─────────────────────────────────────────────

/** An LLM participant in a chat session, with role and system prompt */
export interface SessionLLM {
  savedLLMId: string;
  displayName: string;
  provider: LLMProvider;
  model: string;
  role: string;
  systemPrompt: string;
  /** Accent colour for this LLM in the UI */
  color: string;
}

export type MessageRole = 'user' | 'assistant';

/** A single message in a chat session */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** For assistant messages: which LLM produced this */
  llmDisplayName?: string;
  llmProvider?: LLMProvider;
  llmRole?: string;
  llmColor?: string;
  /** Whether this message is still loading */
  loading?: boolean;
  /** Error message if the LLM call failed */
  error?: string;
  timestamp: number;
}

/** A chat session */
export interface ChatSession {
  id: string;
  name: string;
  llms: SessionLLM[];
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// ─────────────────────────────────────────────
// Backend API types
// ─────────────────────────────────────────────

export interface BackendLLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  systemPrompt: string;
  role: string;
  displayName: string;
}

export interface BackendChatRequest {
  message: string;
  history: { role: MessageRole; content: string }[];
  llms: BackendLLMConfig[];
}

export interface BackendLLMResponse {
  displayName: string;
  role: string;
  content: string;
  provider: string;
  error?: string;
}

export interface BackendChatResponse {
  responses: BackendLLMResponse[];
}
