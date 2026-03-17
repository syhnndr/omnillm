import { Router, Request, Response } from "express";
import { 
  callSingleLLM, 
  SEQUENCE_DECIDER_PROMPT, 
  EXPERT_LANE_DIRECTIVE,
  MASTER_MODERATOR_PROMPT
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

  console.log(`[POST /chat] Incoming request - Message length: ${body.message.length} chars, Experts: ${body.llms.length}, Moderator: ${body.moderator ? 'Yes' : 'No'}`);

  if (!body.message || typeof body.message !== "string") {
    console.error("[POST /chat] Error: message is required");
    return res.status(400).json({ error: "message is required" });
  }

  if (!Array.isArray(body.llms) || body.llms.length === 0) {
    return res.status(400).json({ error: "llms array is required" });
  }

  // Validate that every expert and the moderator have an API key
  const missingKey = body.llms.find(l => !l.apiKey);
  if (missingKey) {
    return res.status(400).json({ error: `Missing API key for expert: ${missingKey.displayName}` });
  }
  if (body.moderator && !body.moderator.apiKey) {
    return res.status(400).json({ error: `Missing API key for moderator: ${body.moderator.displayName}` });
  }

  // Set headers for streaming
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let sortedLLMs = [...body.llms];

    // 1. Initial Sequencing (If Moderator exists)
    if (body.moderator) {
      const expertListString = body.llms.map(l => `"${l.displayName}"`).join(', ');
      const sequenceConfig = {
        ...body.moderator,
        systemPrompt: `${SEQUENCE_DECIDER_PROMPT}\n\nExperts available: ${expertListString}`
      };

      try {
        const orderResponse = await callSingleLLM(sequenceConfig, `Decide the best sequence for the following question.

---USER QUESTION---
${body.message}
---END---`, []);
        
        if (orderResponse.error) {
          throw new Error(orderResponse.error);
        }

        if (orderResponse.content) {
          // Robust parsing: find each expert name's position in the response text.
          // This handles comma-separated lists, numbered lists, arrows, prose, etc.
          const responseText = orderResponse.content.toLowerCase();
          const namePositions = body.llms.map(l => {
            // Use word-boundary regex to avoid substring matches (e.g. "Analyst" inside "Tech Analyst")
            const escaped = l.displayName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const match = new RegExp(`\\b${escaped}\\b`).exec(responseText);
            return {
              llm: l,
              position: match ? match.index : -1,
            };
          });

          const foundNames = namePositions.filter(n => n.position !== -1);
          if (foundNames.length > 0) {
            foundNames.sort((a, b) => a.position - b.position);
            const notFound = namePositions.filter(n => n.position === -1).map(n => n.llm);
            sortedLLMs = [...foundNames.map(n => n.llm), ...notFound];
            console.log(`[Sequencer] Moderator decided order: ${sortedLLMs.map(l => l.displayName).join(' -> ')}`);
          } else {
            console.log(`[Sequencer] Could not parse order from response, using default order.`);
          }
        }
      } catch (seqError) {
        const errorMsg = seqError instanceof Error ? seqError.message : "Sequencing failed";
        console.error("[Sequencer] Critical Moderator Error:", errorMsg);
        
        // Return a clean error and FORCE STOP the response
        res.write(JSON.stringify({
          savedLLMId: body.moderator.savedLLMId,
          displayName: body.moderator.displayName,
          provider: body.moderator.provider,
          role: 'Moderator',
          content: '',
          error: `Council Assembly Blocked: The Moderator is offline or misconfigured. (Details: ${errorMsg})`
        }) + "\n");
        res.end();
        return; // EXIT ENTIRE HANDLER - Experts loop will NEVER run
      }
    }

    const baseHistory: ChatMessage[] = [...(body.history || [])];
    const roundResponses: ChatMessage[] = [];

    // 2. Process Experts in sorted order
    for (const llmConfig of sortedLLMs) {
      // Build history: base + previous experts' responses
      // The user message is NOT added here — each provider function appends it automatically
      const fullHistory: ChatMessage[] = [...baseHistory, ...roundResponses];

      const contextualHistory: ChatMessage[] = fullHistory.map((msg) => ({
        role: msg.role,
        content: msg.name ? `[${msg.name}]: ${msg.content}` : msg.content,
      }));

      // Tell frontend who is thinking right now
      res.write(JSON.stringify({ type: 'status', status: 'thinking', name: llmConfig.displayName }) + "\n");

      // Inject the Lane Directive
      const expertConfigWithDirective = {
        ...llmConfig,
        systemPrompt: llmConfig.systemPrompt
          ? `${llmConfig.systemPrompt}\n\n${EXPERT_LANE_DIRECTIVE}`
          : EXPERT_LANE_DIRECTIVE,
      };

      const response = await callSingleLLM(expertConfigWithDirective, body.message, contextualHistory);
      
      // Stream this response immediately
      res.write(JSON.stringify(response) + "\n");

      if (!response.error && response.content) {
        roundResponses.push({
          role: "assistant",
          content: response.content,
          name: llmConfig.displayName || llmConfig.role,
        });
      } else if (response.error) {
        // Notify subsequent experts and moderator about the failure.
        // Wrapped in a clear marker so downstream LLMs don't treat it as real content.
        roundResponses.push({
          role: "assistant",
          content: `[SYSTEM NOTE: ${llmConfig.displayName || llmConfig.role} encountered an error and could not provide a response. Proceed without their input.]`,
          name: llmConfig.displayName || llmConfig.role,
        });
      }
    }

    // 3. Process Moderator (Final Synthesis)
    if (body.moderator) {
      // User message is NOT added here — callSingleLLM appends it automatically
      const modHistory: ChatMessage[] = [
        ...baseHistory,
        ...roundResponses,
      ];
      const contextualHistory: ChatMessage[] = modHistory.map((msg) => ({
        role: msg.role,
        content: msg.name ? `[${msg.name}]: ${msg.content}` : msg.content,
      }));

      // Tell frontend moderator is synthesizing
      res.write(JSON.stringify({ type: 'status', status: 'synthesizing', name: body.moderator.displayName }) + "\n");

      const moderatorConfig = {
        ...body.moderator,
        systemPrompt: body.moderator.systemPrompt
          ? `${MASTER_MODERATOR_PROMPT}\n\nUser Profile: ${body.moderator.systemPrompt}`
          : MASTER_MODERATOR_PROMPT,
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
    // Include identifying fields so the frontend can render a proper error bubble
    // instead of producing a message with undefined savedLLMId.
    res.write(JSON.stringify({
      savedLLMId: body.moderator?.savedLLMId ?? 'system',
      displayName: body.moderator?.displayName ?? 'System',
      role: 'Moderator',
      provider: body.moderator?.provider ?? 'system',
      content: '',
      error: errorMsg,
    }) + "\n");
    res.end();
  }
});

export default router;
