/**
 * AI Embeddings Client
 *
 * Configured to use Vercel AI Gateway for embeddings.
 * Uses text-embedding-3-large (3072 dimensions) for high-quality vectors.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { embed as aiEmbed, embedMany as aiEmbedMany } from "ai";

// Create OpenAI-compatible provider pointing to Vercel AI Gateway
const openaiGateway = createOpenAI({
  apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY,
  baseURL: "https://ai-gateway.vercel.sh/v1",
});

// Export the embedding model
export const embeddingModel = openaiGateway.embedding("text-embedding-3-large");

/**
 * Generate embedding for a single text
 * Uses Vercel AI Gateway with text-embedding-3-large (3072 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await aiEmbed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple texts
 * Uses Vercel AI Gateway with text-embedding-3-large (3072 dimensions)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await aiEmbedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}
