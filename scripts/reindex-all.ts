/**
 * Reindex All Posts Script
 *
 * Re-embeds all existing posts from Supabase imported_posts table
 * to the new Pinecone index with 3072-dimension embeddings.
 *
 * Features:
 * - Reads from Supabase imported_posts table
 * - Chunks content with ~800 words and 10% overlap
 * - Embeds using text-embedding-3-large (3072 dimensions)
 * - Stores full content with YAML frontmatter in Pinecone metadata
 *
 * Usage:
 *   npx tsx scripts/reindex-all.ts
 *   npx tsx scripts/reindex-all.ts --dry-run
 *   npx tsx scripts/reindex-all.ts --source jon
 *   npx tsx scripts/reindex-all.ts --source nate
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import { config } from "dotenv";
import { chunkContent, type ChunkMetadata, type ContentChunk } from "../src/lib/chunking";

// Load environment variables
config({ path: path.join(__dirname, "..", ".env.local") });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "content-master-pro-v2";

const NAMESPACES = {
  jon: "jon-substack",
  nate: "nate-substack",
};

const BATCH_SIZE = 20; // Process 20 chunks at a time for embeddings

interface ImportedPost {
  id: string;
  source: string;
  external_id: string;
  url: string;
  title: string;
  subtitle: string | null;
  content: string;
  author: string;
  published_at: string | null;
  pinecone_id: string | null;
  metadata: Record<string, unknown>;
}

// Parse command line arguments
function parseArgs(): { source: "jon" | "nate" | "all"; dryRun: boolean } {
  const args = process.argv.slice(2);
  let source: "jon" | "nate" | "all" = "all";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      const s = args[i + 1].toLowerCase();
      if (s === "jon" || s === "nate" || s === "all") {
        source = s;
      }
      i++;
    }
    if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { source, dryRun };
}

// Strip HTML tags and decode entities
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

// Convert post to chunks with metadata
function postToChunks(post: ImportedPost): ContentChunk[] {
  const isJon = post.source.includes("jon");
  const plainContent = stripHtml(post.content || "");

  const chunkMetadata: ChunkMetadata = {
    title: post.title,
    author: post.author || (isJon ? "Jonathan Edwards" : "Nate"),
    url: post.url || "",
    published: post.published_at?.split("T")[0] || "",
    source: isJon ? "jon_substack" : "nate_substack",
  };

  return chunkContent(plainContent, chunkMetadata);
}

// Main reindex function
async function reindexAll(source: "jon" | "nate" | "all", dryRun: boolean) {
  console.log(`\n🚀 Starting reindex (source: ${source}, dry-run: ${dryRun})\n`);

  // Initialize clients
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

  console.log(`📍 Using Pinecone index: ${PINECONE_INDEX}`);
  const index = pinecone.index(PINECONE_INDEX);

  // Build query based on source filter
  let query = supabase.from("imported_posts").select("*");

  if (source === "jon") {
    query = query.ilike("source", "%jon%");
  } else if (source === "nate") {
    query = query.ilike("source", "%nate%");
  }

  // Fetch all posts
  const { data: posts, error } = await query;

  if (error) {
    console.error("Failed to fetch posts:", error);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log("No posts found to reindex.");
    return;
  }

  console.log(`📊 Total posts to reindex: ${posts.length}`);

  // Generate all chunks
  interface ChunkWithPost {
    chunk: ContentChunk;
    post: ImportedPost;
    chunkId: string;
  }

  const allChunks: ChunkWithPost[] = [];

  for (const post of posts) {
    const chunks = postToChunks(post);
    const isJon = post.source.includes("jon");
    const baseId = `${isJon ? "jon" : "nate"}_${post.external_id?.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 50)}`;

    for (const chunk of chunks) {
      const chunkId = `${baseId}-chunk-${chunk.chunkIndex}`;
      allChunks.push({ chunk, post, chunkId });
    }
  }

  console.log(`📦 Total chunks to embed: ${allChunks.length}`);

  if (dryRun) {
    console.log("\n🔍 DRY RUN - No changes will be made\n");
    console.log("Sample posts and chunks:");
    posts.slice(0, 3).forEach((p) => {
      const chunks = postToChunks(p);
      console.log(`  - ${p.title} (${p.source})`);
      console.log(`    Chunks: ${chunks.length}`);
      console.log(`    Content length: ${(p.content || "").length} chars`);
      if (chunks.length > 0) {
        console.log(`    First chunk preview:`);
        console.log(`      ${chunks[0].content.slice(0, 200)}...`);
      }
    });
    return;
  }

  // Clear old vectors from namespaces we're reindexing
  const namespacesToClear: string[] = [];
  if (source === "all" || source === "jon") {
    namespacesToClear.push(NAMESPACES.jon);
  }
  if (source === "all" || source === "nate") {
    namespacesToClear.push(NAMESPACES.nate);
  }

  for (const ns of namespacesToClear) {
    console.log(`\n🗑️  Clearing namespace '${ns}'...`);
    try {
      await index.namespace(ns).deleteAll();
      console.log(`   ✅ Namespace '${ns}' cleared`);
    } catch (err) {
      console.warn(`   ⚠️  Could not clear namespace '${ns}':`, err);
    }
  }

  // Process chunks in batches
  let totalUpserted = 0;
  const startTime = Date.now();

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);

    console.log(`\n⏳ Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`);

    // Create embeddings for this batch using Vercel AI SDK
    const textsToEmbed = batch.map((item) => item.chunk.content);

    try {
      // Generate embeddings using Vercel AI SDK with text-embedding-3-large
      console.log("   Generating embeddings with text-embedding-3-large...");
      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-large"),
        values: textsToEmbed,
      });

      // Group vectors by namespace
      const jonVectors: Array<{ id: string; values: number[]; metadata: Record<string, string | number> }> = [];
      const nateVectors: Array<{ id: string; values: number[]; metadata: Record<string, string | number> }> = [];

      batch.forEach((item, idx) => {
        const isJon = item.post.source.includes("jon");
        const vector = {
          id: item.chunkId,
          values: embeddings[idx],
          metadata: {
            // Full chunk content with YAML frontmatter
            content: item.chunk.content,
            // Flat metadata fields for Pinecone filtering
            title: item.post.title,
            subtitle: item.post.subtitle || "",
            author: item.post.author || (isJon ? "Jonathan Edwards" : "Nate"),
            source: isJon ? "jon_substack" : "nate_substack",
            url: item.post.url || "",
            published_at: item.post.published_at || "",
            chunk_index: item.chunk.chunkIndex,
            chunk_count: item.chunk.chunkCount,
          },
        };

        if (isJon) {
          jonVectors.push(vector);
        } else {
          nateVectors.push(vector);
        }
      });

      // Upsert to respective namespaces
      if (jonVectors.length > 0) {
        console.log(`   Upserting ${jonVectors.length} vectors to namespace '${NAMESPACES.jon}'...`);
        await index.namespace(NAMESPACES.jon).upsert(jonVectors);
        totalUpserted += jonVectors.length;
      }

      if (nateVectors.length > 0) {
        console.log(`   Upserting ${nateVectors.length} vectors to namespace '${NAMESPACES.nate}'...`);
        await index.namespace(NAMESPACES.nate).upsert(nateVectors);
        totalUpserted += nateVectors.length;
      }

      // Progress indicator
      const progress = Math.round(((i + batch.length) / allChunks.length) * 100);
      console.log(`   Progress: ${progress}%`);

    } catch (error) {
      console.error("   Batch error:", error);
    }

    // Rate limit protection
    if (i + BATCH_SIZE < allChunks.length) {
      console.log("   Waiting 500ms before next batch...");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log(`\n✅ Reindex complete!`);
  console.log(`   Posts processed: ${posts.length}`);
  console.log(`   Chunks embedded: ${totalUpserted}`);
  console.log(`   Duration: ${duration}s`);
}

// Run
const { source, dryRun } = parseArgs();
reindexAll(source, dryRun).catch(console.error);
