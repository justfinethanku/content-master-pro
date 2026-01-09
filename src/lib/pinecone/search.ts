import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { getPineconeClient } from "./client";

// Namespaces for different sources
export const SEARCH_NAMESPACES = {
  JON: "jon-substack",
  NATE: "nate-substack",
  ALL: "", // Empty string means search all namespaces
} as const;

export type SearchNamespace = (typeof SEARCH_NAMESPACES)[keyof typeof SEARCH_NAMESPACES];

export interface SearchOptions {
  query: string;
  sources?: ("jon" | "nate")[];
  topK?: number;
  includeMetadata?: boolean;
}

export interface SearchResult {
  id: string;
  score: number;
  title: string;
  subtitle?: string;
  author: string;
  source: string;
  url?: string;
  publishedAt?: string;
  content: string; // Full chunk content with frontmatter
  contentPreview: string; // Legacy field for backward compatibility
  chunkIndex?: number;
  chunkCount?: number;
}

// Use new index with 3072 dimensions
const INDEX_NAME = process.env.PINECONE_INDEX || "content-master-pro-v2";

/**
 * Search for similar content across Jon's and Nate's posts
 *
 * Uses Vercel AI SDK with text-embedding-3-large (3072 dimensions)
 */
export async function searchPosts(options: SearchOptions): Promise<SearchResult[]> {
  const {
    query,
    sources = ["jon", "nate"],
    topK = 10,
    includeMetadata = true,
  } = options;

  const client = getPineconeClient();
  const index = client.index(INDEX_NAME);

  // Generate query embedding using Vercel AI SDK with text-embedding-3-large
  const { embedding: queryVector } = await embed({
    model: openai.embedding("text-embedding-3-large"),
    value: query,
  });

  // Search in each namespace and combine results
  const allResults: SearchResult[] = [];

  for (const source of sources) {
    const namespace = source === "jon" ? SEARCH_NAMESPACES.JON : SEARCH_NAMESPACES.NATE;

    const queryResponse = await index.namespace(namespace).query({
      vector: queryVector,
      topK,
      includeMetadata,
    });

    for (const match of queryResponse.matches) {
      const metadata = match.metadata as Record<string, unknown>;

      allResults.push({
        id: match.id,
        score: match.score ?? 0,
        title: (metadata?.title as string) || "Untitled",
        subtitle: metadata?.subtitle as string,
        author: (metadata?.author as string) || "Unknown",
        source: (metadata?.source as string) || source,
        url: metadata?.url as string,
        publishedAt: (metadata?.published_at as string) || (metadata?.published as string),
        content: (metadata?.content as string) || "",
        contentPreview: (metadata?.content_preview as string) || (metadata?.content as string)?.slice(0, 500) || "",
        chunkIndex: metadata?.chunk_index as number | undefined,
        chunkCount: metadata?.chunk_count as number | undefined,
      });
    }
  }

  // Sort by score and return top results
  allResults.sort((a, b) => b.score - a.score);
  return allResults.slice(0, topK);
}

/**
 * Get post by ID
 */
export async function getPostById(
  id: string,
  namespace: SearchNamespace = SEARCH_NAMESPACES.JON
): Promise<SearchResult | null> {
  const client = getPineconeClient();
  const index = client.index(INDEX_NAME);
  const ns = index.namespace(namespace);

  const result = await ns.fetch([id]);
  const record = result.records[id];

  if (!record) return null;

  const metadata = record.metadata as Record<string, unknown>;

  return {
    id: record.id,
    score: 1,
    title: (metadata?.title as string) || "Untitled",
    subtitle: metadata?.subtitle as string,
    author: (metadata?.author as string) || "Unknown",
    source: (metadata?.source as string) || "",
    url: metadata?.url as string,
    publishedAt: (metadata?.published_at as string) || (metadata?.published as string),
    content: (metadata?.content as string) || "",
    contentPreview: (metadata?.content_preview as string) || (metadata?.content as string)?.slice(0, 500) || "",
    chunkIndex: metadata?.chunk_index as number | undefined,
    chunkCount: metadata?.chunk_count as number | undefined,
  };
}
