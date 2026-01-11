import { SupabaseClient } from "@supabase/supabase-js";
import { getPineconeClient, getPineconeIndexName } from "./client";
import { getSearchableNamespaces, getNamespaceBySlug } from "./namespaces";
import { generateEmbedding } from "@/lib/ai/embeddings";

export interface SearchOptions {
  query: string;
  namespaces?: string[]; // Namespace slugs to search (e.g., ["jon", "nate"])
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
  namespace?: string; // The namespace this result came from
}

/**
 * Search for similar content across configured namespaces
 *
 * Uses Vercel AI SDK with text-embedding-3-large (3072 dimensions)
 *
 * @param supabase - Supabase client for loading namespace config
 * @param options - Search options including query and namespace filters
 */
export async function searchPosts(
  supabase: SupabaseClient,
  options: SearchOptions
): Promise<SearchResult[]> {
  const { query, namespaces, topK = 10, includeMetadata = true } = options;

  const client = getPineconeClient();
  const index = client.index(getPineconeIndexName());

  // Generate query embedding using Vercel AI Gateway with text-embedding-3-large
  const queryVector = await generateEmbedding(query);

  // Determine which namespaces to search
  let namespacesToSearch: string[];

  if (namespaces && namespaces.length > 0) {
    // Use provided namespaces
    namespacesToSearch = namespaces;
  } else {
    // Load searchable namespaces from database
    const searchableNs = await getSearchableNamespaces(supabase);
    namespacesToSearch = searchableNs.map((ns) => ns.slug);
  }

  // Search in each namespace and combine results
  const allResults: SearchResult[] = [];

  for (const namespace of namespacesToSearch) {
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
        source: (metadata?.source as string) || namespace,
        url: metadata?.url as string,
        publishedAt:
          (metadata?.published_at as string) || (metadata?.published as string),
        content: (metadata?.content as string) || "",
        contentPreview:
          (metadata?.content_preview as string) ||
          (metadata?.content as string)?.slice(0, 500) ||
          "",
        chunkIndex: metadata?.chunk_index as number | undefined,
        chunkCount: metadata?.chunk_count as number | undefined,
        namespace,
      });
    }
  }

  // Sort by score and return top results
  allResults.sort((a, b) => b.score - a.score);
  return allResults.slice(0, topK);
}

/**
 * Get post by ID from a specific namespace
 */
export async function getPostById(
  supabase: SupabaseClient,
  id: string,
  namespace: string
): Promise<SearchResult | null> {
  // Validate namespace exists
  const ns = await getNamespaceBySlug(supabase, namespace);
  if (!ns) {
    console.warn(`Namespace not found: ${namespace}`);
    return null;
  }

  const client = getPineconeClient();
  const index = client.index(getPineconeIndexName());
  const nsIndex = index.namespace(namespace);

  const result = await nsIndex.fetch([id]);
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
    publishedAt:
      (metadata?.published_at as string) || (metadata?.published as string),
    content: (metadata?.content as string) || "",
    contentPreview:
      (metadata?.content_preview as string) ||
      (metadata?.content as string)?.slice(0, 500) ||
      "",
    chunkIndex: metadata?.chunk_index as number | undefined,
    chunkCount: metadata?.chunk_count as number | undefined,
    namespace,
  };
}

/**
 * Legacy function for backward compatibility
 * Maps old source names to new namespace slugs
 */
export function mapSourceToNamespace(source: "jon" | "nate"): string {
  // Direct mapping - new namespace names match source names
  return source;
}
