import { NextRequest } from "next/server";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { searchPosts, type SearchResult } from "@/lib/pinecone/search";

// Create Vercel AI Gateway client (OpenAI-compatible)
const gateway = createOpenAI({
  apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY!,
  baseURL: "https://ai-gateway.vercel.sh/v1",
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  sources?: ("jon" | "nate")[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const { messages, sources = ["jon", "nate"] } = body;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the latest user message for search context
    const latestUserMessage = messages.filter((m) => m.role === "user").pop();
    if (!latestUserMessage) {
      return new Response(JSON.stringify({ error: "No user message found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Search for relevant posts to use as context
    const searchResults = await searchPosts({
      query: latestUserMessage.content,
      sources,
      topK: 5,
    });

    // Build context from search results
    const context = buildContext(searchResults);

    // Build the system prompt with RAG context
    const systemPrompt = `You are a helpful assistant with access to a knowledge base of newsletter posts from Jon Edwards and Nate Kadlac.

Your job is to answer questions using the provided context from their posts. When you reference information from the posts, cite them by mentioning the author and post title.

Here are the relevant posts from the knowledge base:

${context}

Guidelines:
- Answer based on the context provided above
- If you reference a specific post, mention the author and title
- If the context doesn't contain relevant information, say so honestly
- Be conversational and helpful
- Keep responses focused and concise`;

    // Stream the response using Vercel AI SDK
    const result = streamText({
      model: gateway("anthropic/claude-sonnet-4-5"),
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      maxOutputTokens: 1024,
      temperature: 0.7,
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
