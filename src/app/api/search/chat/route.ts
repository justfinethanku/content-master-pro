import { NextRequest } from "next/server";
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { searchPosts, type SearchResult } from "@/lib/pinecone/search";
import {
  loadActivePromptConfig,
  interpolateTemplate,
} from "@/lib/supabase/prompts";
import { logAICall } from "@/lib/supabase/ai-logging";

// Create Vercel AI Gateway client (OpenAI-compatible)
// Uses Chat Completions API, not the OpenAI Responses API
const gateway = createOpenAICompatible({
  name: "vercel-ai-gateway",
  apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY!,
  baseURL: "https://ai-gateway.vercel.sh/v1",
});

interface ChatRequestBody {
  messages: Array<{
    id?: string;
    role: "user" | "assistant";
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  }>;
  sources?: ("jon" | "nate")[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as ChatRequestBody;
    const { messages, sources = ["jon", "nate"] } = body;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load prompt config from database (Rule 2: No hardcoded model IDs)
    const promptConfig = await loadActivePromptConfig("search_chat");

    // Get the latest user message for search context
    const latestUserMessage = messages.filter((m) => m.role === "user").pop();
    if (!latestUserMessage) {
      return new Response(JSON.stringify({ error: "No user message found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract text from message (handles both content and parts formats)
    const searchQuery = getTextFromMessage(latestUserMessage);

    // Search for relevant posts to use as context
    const searchResults = await searchPosts({
      query: searchQuery,
      sources,
      topK: 5,
    });

    // Build context from search results
    const context = buildContext(searchResults);

    // Build system prompt with RAG context using database template
    const systemPrompt = interpolateTemplate(promptConfig.promptContent, {
      context,
    });

    // Convert messages to format for streamText
    const coreMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: getTextFromMessage(m),
    }));

    // Stream response with proper message conversion (AI SDK v6 format)
    const result = streamText({
      model: gateway(promptConfig.modelId),
      system: systemPrompt,
      messages: coreMessages,
      maxOutputTokens: promptConfig.apiConfig.max_tokens || 1024,
      temperature: promptConfig.apiConfig.temperature || 0.7,
      onFinish: async ({ text, usage }) => {
        // Log AI call (Rule 13: AI Call Logging)
        await logAICall({
          promptSetSlug: "search_chat",
          fullPrompt: systemPrompt,
          fullResponse: text,
          modelId: promptConfig.modelId,
          tokensIn: usage?.inputTokens,
          tokensOut: usage?.outputTokens,
          durationMs: Date.now() - startTime,
        });
      },
    });

    // Return the streaming response
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: "Chat failed", details: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Extract text from a message that may have either:
 * - content: string (old format)
 * - parts: Array<{ type: 'text', text: string }> (AI SDK v6 format)
 */
function getTextFromMessage(message: {
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  // Try content first (simpler format)
  if (message.content) {
    return message.content;
  }

  // Handle parts array (AI SDK v6 format)
  if (message.parts) {
    return message.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("");
  }

  return "";
}

function buildContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No relevant posts found in the knowledge base.";
  }

  return results
    .map((r, i) => {
      const date = r.publishedAt
        ? new Date(r.publishedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "Unknown date";

      return `[${i + 1}] "${r.title}" by ${r.author} (${date})
${r.contentPreview}
${r.url ? `URL: ${r.url}` : ""}`;
    })
    .join("\n\n---\n\n");
}
