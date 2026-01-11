import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPineconeClient, getPineconeIndexName } from "@/lib/pinecone/client";
import { getNamespaceBySlug, mapSourceToNamespaceSlug } from "@/lib/pinecone/namespaces";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { chunkContent, type ChunkMetadata } from "@/lib/chunking";

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

interface SyncRequestBody {
  manifestId: string;
  source: string;
  feedUrl: string;
  authCookie?: string;
}

/**
 * Parse RSS XML and extract items
 */
function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Simple regex-based parsing (works for Substack RSS)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const getTag = (tag: string): string => {
      // Handle both regular and namespaced tags
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
      content: getTag("encoded"), // content:encoded
      enclosure: getEnclosure(),
    });
  }

  return items;
}

/**
 * Strip HTML tags and decode entities
 */
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as SyncRequestBody;
    const { manifestId, source, feedUrl, authCookie } = body;

    if (!manifestId || !source || !feedUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify manifest belongs to user
    const { data: manifest } = await supabase
      .from("sync_manifests")
      .select("*")
      .eq("id", manifestId)
      .eq("user_id", user.id)
      .single();

    if (!manifest) {
      return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    }

    // Determine namespace from source
    const namespaceSlug = mapSourceToNamespaceSlug(source);
    const namespaceConfig = await getNamespaceBySlug(supabase, namespaceSlug);

    if (!namespaceConfig) {
      return NextResponse.json(
        { error: `Namespace not found: ${namespaceSlug}` },
        { status: 400 }
      );
    }

    // Fetch RSS feed
    const headers: HeadersInit = {
      "User-Agent": "Mozilla/5.0 (compatible; ContentMasterPro/1.0)",
      "Accept": "application/rss+xml, application/xml, text/xml",
    };

    if (authCookie) {
      headers["Cookie"] = `substack.sid=${authCookie}`;
    }

    const feedResponse = await fetch(feedUrl, { headers });

    if (!feedResponse.ok) {
      throw new Error(`Failed to fetch RSS feed: ${feedResponse.status}`);
    }

    const feedXml = await feedResponse.text();
    const items = parseRSSFeed(feedXml);

    if (items.length === 0) {
      await supabase
        .from("sync_manifests")
        .update({
          status: "completed",
          last_sync_at: new Date().toISOString(),
          error_message: "No posts found in feed",
        })
        .eq("id", manifestId);

      return NextResponse.json({ synced: 0, message: "No posts found" });
    }

    // Get existing posts to avoid duplicates
    const { data: existingPosts } = await supabase
      .from("imported_posts")
      .select("external_id")
      .eq("source", source);

    const existingIds = new Set(existingPosts?.map((p) => p.external_id) || []);

    // Filter to only new posts
    const newItems = items.filter((item) => !existingIds.has(item.guid || item.link));

    // Process and store new posts
    const pinecone = getPineconeClient();
    const index = pinecone.index(getPineconeIndexName());

    // Use the namespace slug from database
    const ns = index.namespace(namespaceSlug);

    let syncedCount = 0;
    let chunksUpserted = 0;
    const errors: string[] = [];

    const isJon = source.toLowerCase().includes("jon");

    for (const item of newItems) {
      try {
        const plainContent = stripHtml(item.content || item.description);
        const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();

        // Create chunk metadata
        const chunkMetadata: ChunkMetadata = {
          title: item.title,
          author: item.creator || (isJon ? "Jonathan Edwards" : "Nate"),
          url: item.link,
          published: publishedDate.toISOString().split("T")[0],
          source: isJon ? "jon_substack" : "nate_substack",
        };

        // Chunk the content
        const chunks = chunkContent(plainContent, chunkMetadata);

        // Generate embeddings for all chunks
        const chunkTexts = chunks.map((chunk) => chunk.content);
        const embeddings = await generateEmbeddings(chunkTexts);

        // Create unique base ID for Pinecone
        const baseId = `${source}-${Buffer.from(item.guid || item.link).toString("base64").slice(0, 20)}`;

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

        // Store in database (store the first chunk's Pinecone ID for reference)
        await supabase.from("imported_posts").insert({
          user_id: user.id,
          source,
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
            namespace: namespaceSlug,
          },
        });

        syncedCount++;
      } catch (err) {
        console.error(`Failed to process post: ${item.title}`, err);
        errors.push(item.title);
      }
    }

    // Update manifest
    const { data: finalCount } = await supabase
      .from("imported_posts")
      .select("*", { count: "exact", head: true })
      .eq("source", source);

    await supabase
      .from("sync_manifests")
      .update({
        status: errors.length > 0 ? "error" : "completed",
        last_sync_at: new Date().toISOString(),
        post_count: finalCount?.length || manifest.post_count + syncedCount,
        error_message: errors.length > 0 ? `Failed to sync: ${errors.join(", ")}` : null,
      })
      .eq("id", manifestId);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      synced: syncedCount,
      chunks: chunksUpserted,
      skipped: items.length - newItems.length,
      total: items.length,
      errors: errors.length,
      namespace: namespaceSlug,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("Sync error:", error);

    // Try to update manifest with error
    try {
      const body = (await request.clone().json()) as SyncRequestBody;
      const supabase = await createClient();
      await supabase
        .from("sync_manifests")
        .update({
          status: "error",
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", body.manifestId);
    } catch {
      // Ignore update errors
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
