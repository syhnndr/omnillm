import { Router, Request, Response } from 'express';
import { callAllLLMs } from '../services/llm';

const router = Router();

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'cohere' | 'custom';
  model: string;
  apiKey: string;
  systemPrompt: string;
  role: string;
  displayName: string;
  savedLLMId: string;
  /** Only used for custom OpenAI-compatible providers */
  baseUrl?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  llms: LLMConfig[];
}

/**
 * POST /chat
 * Sends the user message to all configured LLMs in parallel.
 */
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as ChatRequest;

  if (!body.message || typeof body.message !== 'string') {
    return res.status(400).json({ error: 'message is required and must be a string' });
  }

  if (!Array.isArray(body.llms) || body.llms.length === 0) {
    return res.status(400).json({ error: 'llms must be a non-empty array' });
  }

  const responses = await callAllLLMs(body.message, body.history || [], body.llms);
  return res.json({ responses });
});

export default router;
