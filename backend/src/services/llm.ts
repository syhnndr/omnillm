import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMConfig, ChatMessage } from '../routes/chat';

export interface LLMResponse {
  savedLLMId: string;
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
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  });

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

  // Merge consecutive same-role messages to satisfy Anthropic's strict alternation
  // requirement without injecting artificial bridging messages (e.g. "Continue.")
  for (const h of history) {
    const last = messages[messages.length - 1];
    if (last && last.role === h.role) {
      last.content = (last.content as string) + '\n\n' + h.content;
    } else {
      messages.push({ role: h.role, content: h.content });
    }
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

  // Merge consecutive same-role messages to satisfy Gemini's alternating
  // user/model turn requirement without injecting artificial bridging messages
  for (const h of history) {
    const role = h.role === 'assistant' ? 'model' : 'user';
    const last = geminiHistory[geminiHistory.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: h.content });
    } else {
      geminiHistory.push({ role, parts: [{ text: h.content }] });
    }
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
export async function callSingleLLM(
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
      savedLLMId: config.savedLLMId,
      displayName: config.displayName,
      role: config.role,
      content,
      provider: config.provider,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      savedLLMId: config.savedLLMId,
      displayName: config.displayName,
      role: config.role,
      content: '',
      provider: config.provider,
      error: errorMessage,
    };
  }
}

export const MASTER_MODERATOR_PROMPT = `
You are the Moderator of an LLM Council. Your role is to:
1. Orchestrate the discussion between multiple specialized AI agents.
2. Review their individual insights and identify points of consensus or disagreement.
3. Synthesize a final, unified response for the user that combines the best parts of the experts' advice.
4. If there's a conflict between experts, use your judgment to decide the most robust path forward.

Be concise, professional, and act as the final decision-maker. Refrain from just repeating what others said; instead, provide a synthesized conclusion based on the expert discussion.
`;

export const SEQUENCE_DECIDER_PROMPT = `
You are the Orchestrator of an LLM Council. 
Given a USER QUESTION and a list of EXPERTS, decide the most logical ORDER for them to speak.
Order them so that the most fundamental or broad expertise comes first, followed by more specific or dependent expertise.

Respond ONLY with a comma-separated list of the experts' display names in the chosen order.
Example Output: Expert A,Expert B,Expert C
`;

export const EXPERT_LANE_DIRECTIVE = `
ADVISORY: Listen to the previous experts in this council. If their insights overlap with your expertise or affect your commentary, acknowledge and build upon them. However, CRITICAL: stay strictly within your own area of expertise. Do not attempt to answer parts of the question that belong to other roles.
`;


