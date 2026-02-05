import { getPineconeClient, getPineconeIndexName } from "./client";
import { NAMESPACE_SLUGS } from "./namespaces";
import { generateEmbedding } from "@/lib/ai/embeddings";

export interface ResearchSearchResult {
  id: string;
  score: number;
  query: string;
  contentPreview: string;
  sessionId: string;
  createdAt: string;
  wordCount: number;
}

export interface SearchResearchOptions {
  query: string;
  topK?: number;
  minScore?: number;
}

/**
 * Search for similar past research in Pinecone
 *
 * @param options - Search options including query and result limits
 * @returns Array of matching research results sorted by relevance
 */
export async function searchResearch(
  options: SearchResearchOptions
): Promise<ResearchSearchResult[]> {
  const { query, topK = 5, minScore = 0.5 } = options;

  const client = getPineconeClient();
  const index = client.index(getPineconeIndexName());
  const namespace = index.namespace(NAMESPACE_SLUGS.RESEARCH);

  // Generate query embedding using the same model as indexing
  const queryVector = await generateEmbedding(query);

  // Query Pinecone
  const queryResponse = await namespace.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });

  // Transform and filter results
  const results: ResearchSearchResult[] = [];

  for (const match of queryResponse.matches) {
    // Filter out low-score matches
    if ((match.score ?? 0) < minScore) continue;

    const metadata = match.metadata as Record<string, unknown>;

    results.push({
      id: (metadata?.id as string) || match.id.replace("research-", ""),
      score: match.score ?? 0,
      query: (metadata?.query as string) || "",
      contentPreview: (metadata?.content_preview as string) || "",
      sessionId: (metadata?.session_id as string) || "",
      createdAt: (metadata?.created_at as string) || "",
      wordCount: (metadata?.word_count as number) || 0,
    });
  }

  return results;
}

/**
 * Check if any relevant research exists for a query
 * Quick check before showing past research UI
 *
 * @param query - Search query to check
 * @param minScore - Minimum relevance score (default 0.6)
 * @returns True if relevant research exists
 */
export async function hasRelevantResearch(
  query: string,
  minScore = 0.6
): Promise<boolean> {
  const results = await searchResearch({ query, topK: 1, minScore });
  return results.length > 0;
}
