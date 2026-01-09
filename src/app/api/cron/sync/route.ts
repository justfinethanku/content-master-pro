import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPineconeClient } from "@/lib/pinecone/client";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { chunkContent, type ChunkMetadata } from "@/lib/chunking";

/**
 * Daily cron job to sync all configured newsletters
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync",
 *     "schedule": "0 6 * * *"
 *   }]
 * }
 */

interface RSSItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  creator: string;
  description: string;
  content: string;
  enclosure?: string;
}

// Use new index with 3072 dimensions
const INDEX_NAME = process.env.PINECONE_INDEX || "content-master-pro-v2";

function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const getTag = (tag: string): string => {
      const patterns = [
        new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`),
        new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`),
        new RegExp(`<dc:${tag}>([\\s\\S]*?)</dc:${tag}>`),
        new RegExp(`<content:${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></content:${tag}>`),
      ];

      for (const pattern of patterns) {
        const tagMatch = itemXml.match(pattern);
        if (tagMatch) return tagMatch[1].trim();
      }
      return "";
    };

    const getEnclosure = (): string | undefined => {
      const encMatch = itemXml.match(/<enclosure[^>]*url="([^"]*)"[^>]*>/);
      return encMatch ? encMatch[1] : undefined;
    };

    items.push({
      title: getTag("title"),
      link: getTag("link"),
      guid: getTag("guid"),
      pubDate: getTag("pubDate"),
      creator: getTag("creator"),
      description: getTag("description"),
      content: getTag("encoded"),
      enclosure: getEnclosure(),
    });
  }

  return items;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate embeddings for multiple texts using Vercel AI SDK
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-large"),
    values: texts,
  });
  return embeddings;
}

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: Array<{ source: string; synced: number; chunks: number; errors: number }> = [];

  try {
    const supabase = await createServiceClient();

    // Get all manifests with auto_sync enabled
    const { data: manifests, error: fetchError } = await supabase
      .from("sync_manifests")
      .select("*")
      .filter("sync_config->auto_sync", "eq", true);

    if (fetchError) {
      throw fetchError;
    }

    if (!manifests || manifests.length === 0) {
      return NextResponse.json({
        message: "No newsletters configured for auto-sync",
        duration: `${Date.now() - startTime}ms`,
      });
    }

    const pinecone = getPineconeClient();
    const index = pinecone.index(INDEX_NAME);

    for (const manifest of manifests) {
      const syncConfig = manifest.sync_config as {
        newsletter_url?: string;
        auth_cookie?: string;
      };

      if (!syncConfig?.newsletter_url) continue;

      try {
        // Update status to syncing
        await supabase
          .from("sync_manifests")
          .update({ status: "syncing", error_message: null })
          .eq("id", manifest.id);

        // Fetch RSS feed
        const headers: HeadersInit = {
          "User-Agent": "Mozilla/5.0 (compatible; ContentMasterPro/1.0)",
          "Accept": "application/rss+xml, application/xml, text/xml",
        };

        if (syncConfig.auth_cookie) {
          headers["Cookie"] = `substack.sid=${syncConfig.auth_cookie}`;
        }

        const feedResponse = await fetch(syncConfig.newsletter_url, { headers });

        if (!feedResponse.ok) {
          throw new Error(`Failed to fetch RSS: ${feedResponse.status}`);
        }

        const feedXml = await feedResponse.text();
        const items = parseRSSFeed(feedXml);

        // Get existing posts
        const { data: existingPosts } = await supabase
          .from("imported_posts")
          .select("external_id")
          .eq("source", manifest.source);

        const existingIds = new Set(existingPosts?.map((p) => p.external_id) || []);
        const newItems = items.filter((item) => !existingIds.has(item.guid || item.link));

        // Determine namespace
        const namespace = manifest.source.includes("jon") ? "jon-substack" : "nate-substack";
        const ns = index.namespace(namespace);

        let syncedCount = 0;
        let chunksUpserted = 0;
        let errorCount = 0;

        for (const item of newItems) {
          try {
            const plainContent = stripHtml(item.content || item.description);
            const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();

            // Create chunk metadata
            const chunkMetadata: ChunkMetadata = {
              title: item.title,
              author: item.creator || (manifest.source.includes("jon") ? "Jonathan Edwards" : "Nate"),
              url: item.link,
              published: publishedDate.toISOString().split("T")[0],
              source: manifest.source.includes("jon") ? "jon_substack" : "nate_substack",
            };

            // Chunk the content
            const chunks = chunkContent(plainContent, chunkMetadata);

            // Generate embeddings for all chunks
            const chunkTexts = chunks.map((chunk) => chunk.content);
            const embeddings = await generateEmbeddings(chunkTexts);

            // Create unique base ID for Pinecone
            const baseId = `${manifest.source}-${Buffer.from(item.guid || item.link).toString("base64").slice(0, 20)}`;

            // Upsert all chunks to Pinecone
            const vectors = chunks.map((chunk, idx) => ({
              id: `${baseId}-chunk-${chunk.chunkIndex}`,
              values: embeddings[idx],
              metadata: {
                // Full chunk content with YAML frontmatter
                content: chunk.content,
                // Flat metadata fields for Pinecone filtering
                title: item.title,
                author: chunkMetadata.author,
                source: chunkMetadata.source,
                url: item.link,
                published_at: publishedDate.toISOString(),
                chunk_index: chunk.chunkIndex,
                chunk_count: chunk.chunkCount,
              },
            }));

            await ns.upsert(vectors);
            chunksUpserted += vectors.length;

            // Store in database
            await supabase.from("imported_posts").insert({
              user_id: manifest.user_id,
              source: manifest.source,
              external_id: item.guid || item.link,
              url: item.link,
              title: item.title,
              subtitle: item.description?.slice(0, 200),
              content: item.content || item.description,
              author: chunkMetadata.author,
              published_at: publishedDate.toISOString(),
              pinecone_id: `${baseId}-chunk-0`,
              metadata: {
                enclosure: item.enclosure,
                synced_at: new Date().toISOString(),
                chunk_count: chunks.length,
              },
            });

            syncedCount++;
          } catch (err) {
            console.error(`Failed to process post: ${item.title}`, err);
            errorCount++;
          }
        }

        // Update manifest
        const { count: totalCount } = await supabase
          .from("imported_posts")
          .select("*", { count: "exact", head: true })
          .eq("source", manifest.source);

        await supabase
          .from("sync_manifests")
          .update({
            status: "completed",
            last_sync_at: new Date().toISOString(),
            post_count: totalCount || manifest.post_count,
            error_message: null,
          })
          .eq("id", manifest.id);

        results.push({
          source: manifest.source,
          synced: syncedCount,
          chunks: chunksUpserted,
          errors: errorCount,
        });
      } catch (err) {
        console.error(`Failed to sync ${manifest.source}:`, err);

        await supabase
          .from("sync_manifests")
          .update({
            status: "error",
            error_message: err instanceof Error ? err.message : "Unknown error",
          })
          .eq("id", manifest.id);

        results.push({
          source: manifest.source,
          synced: 0,
          chunks: 0,
          errors: 1,
        });
      }
    }

    const duration = Date.now() - startTime;
    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        newsletters: results.length,
        totalSynced,
        totalChunks,
        totalErrors,
        duration: `${duration}ms`,
      },
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
