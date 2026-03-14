import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMConfig, ChatMessage } from '../routes/chat';

export interface LLMResponse {
  displayName: string;
  role: string;
  content: string;
  provider: string;
  error?: string;
}

/**
 * Call a single OpenAI-compatible model.
 */
async function callOpenAI(
  config: LLMConfig,
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const client = new OpenAI({ apiKey: config.apiKey });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (config.systemPrompt) {
    messages.push({ role: 'system', content: config.systemPrompt });
  }

  // Add conversation history
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }

  messages.push({ role: 'user', content: message });

  const completion = await client.chat.completions.create({
    model: config.model || 'gpt-4o',
    messages,
    max_tokens: 2048,
  });

  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Call Anthropic Claude models.
 */
async function callAnthropic(
  config: LLMConfig,
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const messages: Anthropic.MessageParam[] = [];

  // Add conversation history
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }

  messages.push({ role: 'user', content: message });

  const response = await client.messages.create({
    model: config.model || 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    system: config.systemPrompt || undefined,
    messages,
  });

  const block = response.content[0];
  if (block.type === 'text') {
    return block.text;
  }
  return '';
}

/**
 * Call Google Gemini models.
 */
async function callGemini(
  config: LLMConfig,
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({
    model: config.model || 'gemini-1.5-flash',
  });

  // Build history for Gemini (prepend system prompt as the first user/model turn if present)
  const geminiHistory: { role: string; parts: { text: string }[] }[] = [];

  if (config.systemPrompt) {
    geminiHistory.push({ role: 'user', parts: [{ text: config.systemPrompt }] });
    geminiHistory.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }

  for (const h of history) {
    geminiHistory.push({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    });
  }

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(message);
  return result.response.text();
}

/**
 * Call Mistral AI via OpenAI-compatible API.
 */
async function callMistral(
  config: LLMConfig,
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://api.mistral.ai/v1',
  });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (config.systemPrompt) {
    messages.push({ role: 'system', content: config.systemPrompt });
  }

  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }

  messages.push({ role: 'user', content: message });

  const completion = await client.chat.completions.create({
    model: config.model || 'mistral-large-latest',
    messages,
    max_tokens: 2048,
  });

  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Call Cohere via its REST API directly (OpenAI-compatible endpoint).
 */
async function callCohere(
  config: LLMConfig,
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://api.cohere.ai/compatibility/v1',
  });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (config.systemPrompt) {
    messages.push({ role: 'system', content: config.systemPrompt });
  }

  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }

  messages.push({ role: 'user', content: message });

  const completion = await client.chat.completions.create({
    model: config.model || 'command-r-plus',
    messages,
    max_tokens: 2048,
  });

  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Dispatch a single LLM call based on provider.
 */
async function callSingleLLM(
  config: LLMConfig,
  message: string,
  history: ChatMessage[]
): Promise<LLMResponse> {
  try {
    let content = '';

    switch (config.provider) {
      case 'openai':
        content = await callOpenAI(config, message, history);
        break;
      case 'anthropic':
        content = await callAnthropic(config, message, history);
        break;
      case 'google':
        content = await callGemini(config, message, history);
        break;
      case 'mistral':
        content = await callMistral(config, message, history);
        break;
      case 'cohere':
        content = await callCohere(config, message, history);
        break;
      case 'custom':
        // Custom providers use OpenAI-compatible API
        content = await callOpenAI(config, message, history);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    return {
      displayName: config.displayName,
      role: config.role,
      content,
      provider: config.provider,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      displayName: config.displayName,
      role: config.role,
      content: '',
      provider: config.provider,
      error: errorMessage,
    };
  }
}

/**
 * Call all LLMs in parallel using Promise.allSettled so that one failure
 * does not prevent other LLMs from responding.
 */
export async function callAllLLMs(
  message: string,
  history: ChatMessage[],
  llms: LLMConfig[]
): Promise<LLMResponse[]> {
  const results = await Promise.allSettled(
    llms.map((llm) => callSingleLLM(llm, message, history))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // Should not normally reach here because callSingleLLM catches all errors,
    // but handle it defensively.
    return {
      displayName: llms[index].displayName,
      role: llms[index].role,
      content: '',
      provider: llms[index].provider,
      error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
    };
  });
}
