/**
 * Backfill Nate's Posts into Generic Project/Asset System
 *
 * Reads 465 markdown files from Nate's Substack archive,
 * parses frontmatter, generates yyyymmdd_xxx project IDs,
 * and inserts into the new projects/assets/asset_versions/project_publications tables.
 *
 * Usage:
 *   npx tsx scripts/backfill-nate-posts.ts
 *   npx tsx scripts/backfill-nate-posts.ts --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config({ path: path.join(__dirname, "..", ".env.local") });

const NATE_POSTS_DIR =
  "/Users/jonathanedwards/AUTOMATION/SubStack/nate_substack/Natesnewsletter";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DRY_RUN = process.argv.includes("--dry-run");

// Batch size for Supabase inserts
const BATCH_SIZE = 50;

interface ParsedPost {
  filename: string;
  title: string;
  subtitle?: string;
  published: string; // YYYY-MM-DD
  url?: string;
  slug?: string;
  tags?: string[];
  image?: { url?: string } | string;
  author?: string;
  publication?: string;
  linksInternal?: number;
  linksExternal?: number;
  body: string;
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase credentials in .env.local");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * Read and parse all markdown files from Nate's archive
 */
function readAllPosts(): ParsedPost[] {
  const files = fs
    .readdirSync(NATE_POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  console.log(`Found ${files.length} markdown files`);

  const posts: ParsedPost[] = [];

  for (const filename of files) {
    const filepath = path.join(NATE_POSTS_DIR, filename);
    const raw = fs.readFileSync(filepath, "utf-8");
    const { data, content } = matter(raw);

    const published = data.published || data.date;
    if (!published) {
      console.warn(`  SKIP: ${filename} — no published date`);
      continue;
    }

    // Normalize date to YYYY-MM-DD
    const dateStr = String(published).slice(0, 10);

    // Extract image URL from various formats
    let imageUrl: string | undefined;
    if (typeof data.image === "string") {
      imageUrl = data.image;
    } else if (data.image && typeof data.image === "object" && data.image.url) {
      imageUrl = data.image.url;
    }

    posts.push({
      filename,
      title: data.title || filename.replace(/\.md$/, ""),
      subtitle: data.subtitle,
      published: dateStr,
      url: data.url || data.canonical,
      slug: data.slug || filename.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, ""),
      tags: Array.isArray(data.tags) ? data.tags : undefined,
      image: imageUrl ? { url: imageUrl } : undefined,
      author: data.author,
      publication: data.publication,
      linksInternal: data.links_internal,
      linksExternal: data.links_external,
      body: content.trim(),
    });
  }

  return posts;
}

/**
 * Group posts by date and assign sequential project IDs
 */
function assignProjectIds(posts: ParsedPost[]) {
  // Group by publish date
  const byDate = new Map<string, ParsedPost[]>();
  for (const post of posts) {
    const existing = byDate.get(post.published) || [];
    existing.push(post);
    byDate.set(post.published, existing);
  }

  // Within each date, sort alphabetically by slug and assign counters
  const assignments: {
    post: ParsedPost;
    projectId: string;
    assetId: string;
  }[] = [];

  for (const [date, datePosts] of byDate) {
    // Sort by slug for deterministic ordering
    datePosts.sort((a, b) => (a.slug || "").localeCompare(b.slug || ""));

    const dateCompact = date.replace(/-/g, ""); // YYYYMMDD

    for (let i = 0; i < datePosts.length; i++) {
      const counter = String(i + 1).padStart(3, "0");
      const projectId = `${dateCompact}_${counter}`;
      const assetId = `${projectId}_post`;

      assignments.push({
        post: datePosts[i],
        projectId,
        assetId,
      });
    }
  }

  return assignments;
}

/**
 * Look up the user ID to use as created_by
 * Uses service role to query auth.users
 */
async function findUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  // Try to find the first user (single-user app)
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 5 });

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  if (!data.users || data.users.length === 0) {
    throw new Error("No users found in auth.users");
  }

  // Use the first user
  const user = data.users[0];
  console.log(`Using user: ${user.email} (${user.id})`);
  return user.id;
}

/**
 * Insert records in batches
 */
async function batchInsert(
  supabase: ReturnType<typeof createClient>,
  table: string,
  records: Record<string, unknown>[],
) {
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);

    if (error) {
      console.error(`Error inserting batch into ${table} at offset ${i}:`, error.message);
      // Log the first failing record for debugging
      console.error(`  First record in batch:`, JSON.stringify(batch[0]).slice(0, 200));
      throw error;
    }

    inserted += batch.length;
  }

  return inserted;
}

async function main() {
  console.log("=== Nate Posts Backfill ===");
  console.log(DRY_RUN ? "** DRY RUN — no database writes **\n" : "");

  // 1. Read all posts
  const posts = readAllPosts();
  console.log(`Parsed ${posts.length} posts\n`);

  // 2. Assign project IDs
  const assignments = assignProjectIds(posts);
  console.log(`Assigned ${assignments.length} project IDs\n`);

  // Show a few examples
  console.log("Sample assignments:");
  for (const a of assignments.slice(0, 5)) {
    console.log(`  ${a.projectId} — "${a.post.title.slice(0, 60)}"`);
  }
  console.log();

  if (DRY_RUN) {
    // Print summary stats
    const dates = new Set(assignments.map((a) => a.post.published));
    console.log(`Unique dates: ${dates.size}`);
    console.log(`Total projects: ${assignments.length}`);
    console.log(`Total assets: ${assignments.length}`);
    console.log(`Total versions: ${assignments.length}`);
    console.log(`Total publications: ${assignments.length}`);
    console.log("\nDry run complete. No data written.");
    return;
  }

  // 3. Connect to Supabase
  const supabase = getSupabase();
  const userId = await findUserId(supabase);

  // 4. Build all records
  console.log("Building records...");

  const projectRecords: Record<string, unknown>[] = [];
  const nameVersionRecords: Record<string, unknown>[] = [];
  const assetRecords: Record<string, unknown>[] = [];
  const versionRecords: Record<string, unknown>[] = [];
  const publicationRecords: Record<string, unknown>[] = [];

  // We need the UUIDs from the projects insert to link assets.
  // Insert projects first, then query back to get the UUID mapping.
  // Actually, we can generate UUIDs client-side with crypto.randomUUID().

  for (const { post, projectId, assetId } of assignments) {
    const projectUuid = crypto.randomUUID();
    const assetUuid = crypto.randomUUID();

    // Build metadata
    const metadata: Record<string, unknown> = {};
    if (post.subtitle) metadata.subtitle = post.subtitle;
    if (post.tags && post.tags.length > 0) metadata.tags = post.tags;
    if (post.url) metadata.url = post.url;
    if (post.slug) metadata.slug = post.slug;
    if (post.image && typeof post.image === "object" && "url" in post.image) {
      metadata.image = post.image.url;
    }
    if (post.author) metadata.author = post.author;
    if (post.publication) metadata.publication = post.publication;
    if (post.linksInternal !== undefined) metadata.links_internal = post.linksInternal;
    if (post.linksExternal !== undefined) metadata.links_external = post.linksExternal;
    metadata.source = "backfill-nate-posts";
    metadata.original_filename = post.filename;

    // Project
    projectRecords.push({
      id: projectUuid,
      project_id: projectId,
      name: post.title,
      scheduled_date: post.published,
      status: "published",
      metadata,
      created_by: userId,
      created_at: `${post.published}T12:00:00Z`,
      updated_at: `${post.published}T12:00:00Z`,
    });

    // Project name version (initial snapshot)
    nameVersionRecords.push({
      project_id: projectUuid,
      name: post.title,
      changed_by: userId,
      created_at: `${post.published}T12:00:00Z`,
    });

    // Word count for asset metadata
    const wordCount = post.body.split(/\s+/).filter(Boolean).length;

    // Asset
    assetRecords.push({
      id: assetUuid,
      project_id: projectUuid,
      asset_id: assetId,
      name: post.title,
      asset_type: "post",
      platform: "substack",
      content: post.body,
      current_version: 1,
      status: "published",
      metadata: { word_count: wordCount },
      created_at: `${post.published}T12:00:00Z`,
      updated_at: `${post.published}T12:00:00Z`,
    });

    // Asset version (v1 snapshot)
    versionRecords.push({
      asset_id: assetUuid,
      version_number: 1,
      name: post.title,
      content: post.body,
      metadata: { word_count: wordCount },
      change_description: "Initial import from Nate Substack archive",
      created_by: userId,
      created_at: `${post.published}T12:00:00Z`,
    });

    // Publication record (only if we have a URL)
    if (post.url) {
      publicationRecords.push({
        project_id: projectUuid,
        platform: "substack",
        published_at: `${post.published}T12:00:00Z`,
        published_url: post.url,
        metadata: { source: "backfill" },
        created_at: `${post.published}T12:00:00Z`,
      });
    }
  }

  console.log(`Built: ${projectRecords.length} projects, ${assetRecords.length} assets, ${versionRecords.length} versions, ${publicationRecords.length} publications\n`);

  // 5. Insert in dependency order
  console.log("Inserting projects...");
  const projCount = await batchInsert(supabase, "projects", projectRecords);
  console.log(`  Inserted ${projCount} projects`);

  console.log("Inserting project name versions...");
  const nameCount = await batchInsert(supabase, "project_name_versions", nameVersionRecords);
  console.log(`  Inserted ${nameCount} name versions`);

  console.log("Inserting assets...");
  const assetCount = await batchInsert(supabase, "assets", assetRecords);
  console.log(`  Inserted ${assetCount} assets`);

  console.log("Inserting asset versions...");
  const verCount = await batchInsert(supabase, "asset_versions", versionRecords);
  console.log(`  Inserted ${verCount} asset versions`);

  console.log("Inserting project publications...");
  const pubCount = await batchInsert(supabase, "project_publications", publicationRecords);
  console.log(`  Inserted ${pubCount} publications`);

  console.log("\n=== Backfill complete ===");
  console.log(`Projects:     ${projCount}`);
  console.log(`Name versions: ${nameCount}`);
  console.log(`Assets:       ${assetCount}`);
  console.log(`Versions:     ${verCount}`);
  console.log(`Publications: ${pubCount}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
