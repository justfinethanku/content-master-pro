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
  contentPreview: string;
}

const EMBEDDING_MODEL = "multilingual-e5-large";
const INDEX_NAME = process.env.PINECONE_INDEX || "content-master-pro";

/**
 * Search for similar content across Jon's and Nate's posts
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

  // Generate query embedding using Pinecone Inference
  const embeddings = await client.inference.embed(
    EMBEDDING_MODEL,
    [query],
    { inputType: "query", truncate: "END" }
  );

  // Extract values from embedding (dense embedding has values property)
  const embedding = embeddings.data[0];
  if (!("values" in embedding)) {
    throw new Error("Expected dense embedding with values");
  }
  const queryVector = embedding.values;

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
        publishedAt: metadata?.published_at as string,
        contentPreview: (metadata?.content_preview as string) || "",
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
    publishedAt: metadata?.published_at as string,
    contentPreview: (metadata?.content_preview as string) || "",
  };
}
