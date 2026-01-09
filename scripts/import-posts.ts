/**
 * Post Import Script
 *
 * Imports posts from Jon's and Nate's Substack archives into Pinecone
 * vector database for semantic search.
 *
 * Features:
 * - Word-based chunking with 10% overlap (~800 words per chunk)
 * - Full chunk content with YAML frontmatter stored in metadata
 * - Uses text-embedding-3-large (3072 dimensions) via Vercel AI SDK
 *
 * Usage:
 *   npx tsx scripts/import-posts.ts --source jon
 *   npx tsx scripts/import-posts.ts --source nate
 *   npx tsx scripts/import-posts.ts --source all
 *   npx tsx scripts/import-posts.ts --source jon --dry-run
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { config } from "dotenv";
import { chunkContent, type ChunkMetadata, type ContentChunk } from "../src/lib/chunking";

// Load environment variables
config({ path: path.join(__dirname, "..", ".env.local") });

// Configuration
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "content-master-pro-v2";

const PATHS = {
  jon: "/Users/jonathanedwards/AUTOMATION/SubStack/JONS_SUBSTACK/Published",
  nate: "/Users/jonathanedwards/AUTOMATION/SubStack/nate_substack/Natesnewsletter",
};

const NAMESPACES = {
  jon: "jon-substack",
  nate: "nate-substack",
};

const BATCH_SIZE = 20; // Process 20 chunks at a time for embeddings

interface PostData {
  id: string;
  source: "jon_substack" | "nate_substack";
  title: string;
  subtitle?: string;
  content: string;
  url?: string;
  slug?: string;
  publishedAt?: Date;
  author: string;
  filePath: string;
}

interface ParsedFrontmatter {
  title?: string;
  subtitle?: string;
  date?: string;
  published?: string;
  url?: string;
  slug?: string;
  author?: string;
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

// Parse a markdown file with frontmatter
function parseMarkdownFile(
  filePath: string,
  source: "jon" | "nate"
): PostData | null {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);
    const frontmatter = data as ParsedFrontmatter;

    if (!frontmatter.title) {
      console.warn(`  Skipping ${path.basename(filePath)}: No title found`);
      return null;
    }

    // Generate ID from source and slug/filename
    const slug = frontmatter.slug || path.basename(filePath, ".md");
    const id = `${source}_${slug}`;

    // Parse date
    let publishedAt: Date | undefined;
    if (frontmatter.date) {
      publishedAt = new Date(frontmatter.date);
    } else if (frontmatter.published) {
      publishedAt = new Date(frontmatter.published);
    }

    return {
      id,
      source: source === "jon" ? "jon_substack" : "nate_substack",
      title: frontmatter.title,
      subtitle: frontmatter.subtitle,
      content: cleanContent(content),
      url: frontmatter.url,
      slug,
      publishedAt,
      author:
        source === "jon" ? "Jonathan Edwards" : frontmatter.author || "Nate",
      filePath,
    };
  } catch (error) {
    console.error(`  Error parsing ${filePath}:`, error);
    return null;
  }
}

// Clean content for embedding
function cleanContent(content: string): string {
  return (
    content
      // Remove markdown images
      .replace(/!\[.*?\]\(.*?\)/g, "")
      // Remove markdown links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Remove horizontal rules
      .replace(/^\*\s*\*\s*\*\s*$/gm, "")
      .replace(/^-{3,}$/gm, "")
      // Remove excessive whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// Get all markdown files from a directory
function getMarkdownFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    return [];
  }

  const files = fs.readdirSync(dirPath);
  return files
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .map((f) => path.join(dirPath, f));
}

// Convert post to chunks with metadata
function postToChunks(post: PostData): ContentChunk[] {
  const chunkMetadata: ChunkMetadata = {
    title: post.title,
    author: post.author,
    url: post.url || "",
    published: post.publishedAt?.toISOString().split("T")[0] || "",
    source: post.source,
  };

  return chunkContent(post.content, chunkMetadata);
}

// Main import function
async function importPosts(source: "jon" | "nate" | "all", dryRun: boolean) {
  console.log(
    `\n🚀 Starting post import (source: ${source}, dry-run: ${dryRun})\n`
  );

  // Initialize Pinecone client
  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  console.log(`📍 Using Pinecone index: ${PINECONE_INDEX}`);

  const index = pinecone.index(PINECONE_INDEX);

  // Collect all posts to import
  const allPosts: PostData[] = [];
  const sources: ("jon" | "nate")[] =
    source === "all" ? ["jon", "nate"] : [source];

  for (const src of sources) {
    console.log(`\n📂 Reading posts from ${src}...`);
    const dirPath = PATHS[src];
    const files = getMarkdownFiles(dirPath);
    console.log(`   Found ${files.length} markdown files`);

    let parsed = 0;
    for (const file of files) {
      const post = parseMarkdownFile(file, src);
      if (post) {
        allPosts.push(post);
        parsed++;
      }
    }
    console.log(`   Successfully parsed ${parsed} posts`);
  }

  console.log(`\n📊 Total posts to import: ${allPosts.length}`);

  // Generate all chunks
  interface ChunkWithPost {
    chunk: ContentChunk;
    post: PostData;
    chunkId: string;
  }

  const allChunks: ChunkWithPost[] = [];

  for (const post of allPosts) {
    const chunks = postToChunks(post);
    for (const chunk of chunks) {
      const chunkId = `${post.id}-chunk-${chunk.chunkIndex}`;
      allChunks.push({ chunk, post, chunkId });
    }
  }

  console.log(`📦 Total chunks to embed: ${allChunks.length}`);

  if (dryRun) {
    console.log("\n🔍 DRY RUN - No changes will be made\n");
    console.log("Sample posts and chunks:");
    allPosts.slice(0, 3).forEach((p) => {
      const chunks = postToChunks(p);
      console.log(`  - ${p.title} (${p.source})`);
      console.log(`    Chunks: ${chunks.length}`);
      console.log(`    Content length: ${p.content.length} chars`);
      if (chunks.length > 0) {
        console.log(`    First chunk preview:`);
        console.log(`      ${chunks[0].content.slice(0, 200)}...`);
      }
    });
    return;
  }

  // Process chunks in batches
  let totalUpserted = 0;

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    console.log(
      `\n⏳ Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / BATCH_SIZE)} (${batch.length} chunks)...`
    );

    // Create embeddings for this batch using Vercel AI SDK
    const textsToEmbed = batch.map((item) => item.chunk.content);

    try {
      // Generate embeddings using Vercel AI SDK with text-embedding-3-large
      console.log("   Generating embeddings with text-embedding-3-large...");
      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-large"),
        values: textsToEmbed,
      });

      // Prepare vectors for upsert
      const vectors = batch.map((item, idx) => ({
        id: item.chunkId,
        values: embeddings[idx],
        metadata: {
          // Full chunk content with YAML frontmatter
          content: item.chunk.content,
          // Flat metadata fields for Pinecone filtering
          title: item.post.title,
          subtitle: item.post.subtitle || "",
          author: item.post.author,
          source: item.post.source,
          url: item.post.url || "",
          published_at: item.post.publishedAt?.toISOString() || "",
          chunk_index: item.chunk.chunkIndex,
          chunk_count: item.chunk.chunkCount,
        },
      }));

      // Upsert to Pinecone (separate by namespace)
      for (const src of sources) {
        const namespace = NAMESPACES[src];
        const srcVectors = vectors.filter(
          (v) =>
            v.metadata.source ===
            (src === "jon" ? "jon_substack" : "nate_substack")
        );

        if (srcVectors.length > 0) {
          console.log(
            `   Upserting ${srcVectors.length} vectors to namespace '${namespace}'...`
          );
          await index.namespace(namespace).upsert(srcVectors);
          totalUpserted += srcVectors.length;
        }
      }
    } catch (error) {
      console.error("   Batch error:", error);
    }

    // Rate limit protection
    if (i + BATCH_SIZE < allChunks.length) {
      console.log("   Waiting 500ms before next batch...");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Posts processed: ${allPosts.length}`);
  console.log(`   Chunks embedded: ${totalUpserted}`);
}

// Run
const { source, dryRun } = parseArgs();
importPosts(source, dryRun).catch(console.error);
