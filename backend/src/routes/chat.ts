import { Router, Request, Response } from "express";
import { 
  callSingleLLM, 
  SEQUENCE_DECIDER_PROMPT, 
  EXPERT_LANE_DIRECTIVE 
} from "../services/llm";

const router = Router();

export interface LLMConfig {
  provider: "openai" | "anthropic" | "google" | "mistral" | "cohere" | "custom";
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
  role: "user" | "assistant";
  content: string;
  name?: string; // Mesajı söyleyenin kimliği (örn: "Analist", "Tasarımcı")
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  llms: LLMConfig[];
  moderator?: LLMConfig;
}

/**
 * POST /chat
 * Sends the user message to LLMs sequentially and streams the results.
 */
router.post("/", async (req: Request, res: Response) => {
  const body = req.body as ChatRequest;

  console.log(`[POST /chat] Incoming request - Message: "${body.message}", Experts: ${body.llms.length}, Moderator: ${body.moderator ? 'Yes' : 'No'}`);

  if (!body.message || typeof body.message !== "string") {
    console.error("[POST /chat] Error: message is required");
    return res.status(400).json({ error: "message is required" });
  }

  if (!Array.isArray(body.llms) || body.llms.length === 0) {
    return res.status(400).json({ error: "llms array is required" });
  }

  // Set headers for streaming
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let sortedLLMs = [...body.llms];

    // 1. Initial Sequencing (If Moderator exists)
    if (body.moderator) {
      const expertListString = body.llms.map(l => `${l.displayName} (ID: ${l.savedLLMId})`).join(', ');
      const sequenceConfig = {
        ...body.moderator,
        systemPrompt: `${SEQUENCE_DECIDER_PROMPT}\n\nExperts available: ${expertListString}`
      };

      try {
        const orderResponse = await callSingleLLM(sequenceConfig, `Decide the best sequence for this question: "${body.message}"`, []);
        
        if (orderResponse.error) {
          throw new Error(orderResponse.error);
        }

        if (orderResponse.content) {
          const orderedIds = orderResponse.content.split(',').map(s => s.trim().toLowerCase());
          console.log(`[Sequencer] Moderator decided order: ${orderedIds.join(' -> ')}`);
          
          sortedLLMs.sort((a, b) => {
            const indexA = orderedIds.indexOf(a.savedLLMId.toLowerCase());
            const indexB = orderedIds.indexOf(b.savedLLMId.toLowerCase());
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
        }
      } catch (seqError) {
        const errorMsg = seqError instanceof Error ? seqError.message : "Sequencing failed";
        console.error("[Sequencer] Critical Moderator Error:", errorMsg);
        
        // Return a clean error and FORCE STOP the response
        res.write(JSON.stringify({ 
          role: 'Moderator', 
          error: `Council Assembly Blocked: The Moderator is offline or misconfigured. (Details: ${errorMsg})` 
        }) + "\n");
        res.end();
        return; // EXIT ENTIRE HANDLER - Experts loop will NEVER run
      }
    }

    const history: ChatMessage[] = [...(body.history || [])];

    // 2. Process Experts in sorted order
    for (const llmConfig of sortedLLMs) {
      const contextualHistory: ChatMessage[] = history.map((msg) => ({
        role: msg.role,
        content: msg.name ? `[${msg.name}]: ${msg.content}` : msg.content,
      }));

      // Tell frontend who is thinking right now
      res.write(JSON.stringify({ type: 'status', status: 'thinking', name: llmConfig.displayName }) + "\n");

      // Inject the Lane Directive
      const expertConfigWithDirective = {
        ...llmConfig,
        systemPrompt: `${llmConfig.systemPrompt}\n\n${EXPERT_LANE_DIRECTIVE}`
      };

      const response = await callSingleLLM(expertConfigWithDirective, body.message, contextualHistory);
      
      // Stream this response immediately
      res.write(JSON.stringify(response) + "\n");

      if (!response.error && response.content) {
        history.push({
          role: "assistant",
          content: response.content,
          name: llmConfig.displayName || llmConfig.role,
        });
      }
    }

    // 3. Process Moderator (Final Synthesis)
    if (body.moderator) {
      const contextualHistory: ChatMessage[] = history.map((msg) => ({
        role: msg.role,
        content: msg.name ? `[${msg.name}]: ${msg.content}` : msg.content,
      }));

      // Tell frontend moderator is synthesizing
      res.write(JSON.stringify({ type: 'status', status: 'synthesizing', name: body.moderator.displayName }) + "\n");

      const moderatorConfig = {
        ...body.moderator,
        systemPrompt: `You are the Moderator of an LLM Council.\n1. Review specialized insights.\n2. Synthesize a unified response.\n3. Be decisive.\n\nUser Profile: ${body.moderator.systemPrompt}`,
      };

      const modResponse = await callSingleLLM(moderatorConfig, body.message, contextualHistory);
      
      const decoratedModResponse = {
        ...modResponse,
        displayName: `Moderator (${body.moderator.displayName})`,
        role: "Moderator",
      };

      res.write(JSON.stringify(decoratedModResponse) + "\n");
    }

    res.end();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.write(JSON.stringify({ error: errorMsg }) + "\n");
    res.end();
  }
});

export default router;
