import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { getPineconeClient, PINECONE_NAMESPACES } from "./client";

// Use new index with 3072 dimensions
const INDEX_NAME = process.env.PINECONE_INDEX || "content-master-pro-v2";
const MAX_CONTENT_LENGTH = 8000; // Characters to truncate to for embedding

export interface ResearchMetadata {
  id: string;
  session_id: string;
  query: string;
  content_preview: string;
  created_at: string;
  word_count: number;
  [key: string]: string | number; // Index signature for Pinecone RecordMetadata compatibility
}

export interface EmbedResearchResult {
  success: boolean;
  vectorId: string;
  error?: string;
}

/**
 * Embed research content and upsert to Pinecone
 *
 * Uses Vercel AI SDK with text-embedding-3-large (3072 dimensions)
 *
 * @param researchId - Database ID of the research record
 * @param query - Original search query
 * @param response - Full research response content
 * @param sessionId - Content session ID
 * @returns Result with success status and vector ID
 */
export async function embedResearch(
  researchId: string,
  query: string,
  response: string,
  sessionId: string
): Promise<EmbedResearchResult> {
  const vectorId = `research-${researchId}`;

  try {
    const client = getPineconeClient();
    const index = client.index(INDEX_NAME);
    const namespace = index.namespace(PINECONE_NAMESPACES.RESEARCH);

    // Truncate content for embedding (model has token limits)
    const contentForEmbedding = response.slice(0, MAX_CONTENT_LENGTH);

    // Generate embedding using Vercel AI SDK with text-embedding-3-large
    const { embedding: vector } = await embed({
      model: openai.embedding("text-embedding-3-large"),
      value: contentForEmbedding,
    });

    // Create metadata
    const metadata: ResearchMetadata = {
      id: researchId,
      session_id: sessionId,
      query: query.slice(0, 500), // Limit query length in metadata
      content_preview: response.slice(0, 500), // First 500 chars as preview
      created_at: new Date().toISOString(),
      word_count: response.split(/\s+/).length,
    };

    // Upsert to Pinecone
    await namespace.upsert([
      {
        id: vectorId,
        values: vector,
        metadata,
      },
    ]);

    return {
      success: true,
      vectorId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to embed research ${researchId}:`, errorMessage);

    return {
      success: false,
      vectorId,
      error: errorMessage,
    };
  }
}

/**
 * Delete research embedding from Pinecone
 *
 * @param researchId - Database ID of the research record
 */
export async function deleteResearchEmbedding(researchId: string): Promise<void> {
  const vectorId = `research-${researchId}`;

  const client = getPineconeClient();
  const index = client.index(INDEX_NAME);
  const namespace = index.namespace(PINECONE_NAMESPACES.RESEARCH);

  await namespace.deleteOne(vectorId);
}
