/**
 * Seed script: Import posts from content-drafts-opus as "idea" projects.
 *
 * Usage: npx tsx scripts/seed-ideas.ts
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const POSTS_DIR =
  "/Users/jonathanedwards/AUTOMATION/Clients/nate work/sonnet 4.6 information/content-drafts-opus/posts";

// Load env
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function generateProjectId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 5);
  return `${y}${m}${d}_${rand}`;
}

async function main() {
  // Look up the first user to assign as creator
  const { data: existingProject } = await supabase
    .from("projects")
    .select("created_by")
    .not("created_by", "is", null)
    .limit(1)
    .single();

  const createdBy = existingProject?.created_by;
  if (!createdBy) {
    console.error("No existing user found in projects table. Cannot assign created_by.");
    process.exit(1);
  }

  // Read all post-*.md files, sorted
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.startsWith("post-") && f.endsWith(".md"))
    .sort()
    .slice(0, 10);

  console.log(`Found ${files.length} posts to seed as ideas.\n`);

  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");

    // Extract title from first line (# Title)
    const firstLine = raw.split("\n")[0];
    const title = firstLine.replace(/^#\s*/, "").trim();

    // Content is everything after the first line
    const content = raw.split("\n").slice(1).join("\n").trim();

    const projectId = generateProjectId();

    // Insert project with status = 'idea'
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        project_id: projectId,
        name: title,
        status: "idea",
        created_by: createdBy,
        metadata: { source_file: file },
      })
      .select()
      .single();

    if (projectError) {
      console.error(`Failed to insert project for ${file}:`, projectError.message);
      continue;
    }

    // Insert post asset
    const assetId = `${projectId}_post_substack_main`;
    const { error: assetError } = await supabase
      .from("project_assets")
      .insert({
        project_id: project.id,
        asset_id: assetId,
        name: title,
        asset_type: "post",
        content,
        status: "draft",
        metadata: { source_file: file },
      });

    if (assetError) {
      console.error(`Failed to insert asset for ${file}:`, assetError.message);
      continue;
    }

    console.log(`  Seeded: "${title}" (${file})`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
