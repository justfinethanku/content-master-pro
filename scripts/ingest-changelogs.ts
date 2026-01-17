/**
 * Ingest Changelogs from AI/Dev Tool Sources
 *
 * This script:
 * 1. Loads the changelog_ingestion prompt from the database
 * 2. For each source, calls Perplexity via Vercel AI Gateway
 * 3. Parses the JSON response
 * 4. Dedupes against existing changelog_items
 * 5. Inserts new items with status = 'unread'
 *
 * Usage:
 *   npx tsx scripts/ingest-changelogs.ts              # Ingest all sources
 *   npx tsx scripts/ingest-changelogs.ts --dry-run    # Preview without saving
 *   npx tsx scripts/ingest-changelogs.ts --source=1   # Only ingest source at index 1
 */

import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

// Changelog sources
const SOURCES = [
  {
    name: "Anthropic",
    url: "https://docs.anthropic.com/en/release-notes/overview",
  },
  { name: "OpenAI", url: "https://platform.openai.com/docs/changelog" },
  { name: "Google Gemini", url: "https://ai.google.dev/gemini-api/docs/changelog" },
  { name: "xAI Grok", url: "https://docs.x.ai/docs/changelog" },
  { name: "Cursor", url: "https://www.cursor.com/changelog" },
  { name: "n8n", url: "https://docs.n8n.io/release-notes/" },
  { name: "Perplexity", url: "https://docs.perplexity.ai/changelog" },
  { name: "Meta Llama", url: "https://ai.meta.com/blog/" },
  { name: "Mistral", url: "https://docs.mistral.ai/getting-started/changelog/" },
  { name: "Windsurf", url: "https://codeium.com/changelog" },
];

// Get Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase credentials in .env.local");
  }
  return createClient(url, key);
}

// Load prompt configuration from database
async function loadPromptConfig(supabase: ReturnType<typeof getSupabase>) {
  const { data: promptSet, error: setError } = await supabase
    .from("prompt_sets")
    .select("id, slug, name")
    .eq("slug", "changelog_ingestion")
    .single();

  if (setError || !promptSet) {
    throw new Error(
      `Failed to load prompt set 'changelog_ingestion': ${setError?.message || "Not found"}`
    );
  }

  const { data: version, error: versionError } = await supabase
    .from("prompt_versions")
    .select(
      `
      id,
      prompt_content,
      api_config,
      model_id,
      ai_models (
        model_id,
        provider,
        display_name
      )
    `
    )
    .eq("prompt_set_id", promptSet.id)
    .eq("status", "active")
    .single();

  if (versionError || !version) {
    throw new Error(
      `No active prompt version found: ${versionError?.message || "Not found"}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = Array.isArray(version.ai_models)
    ? (version.ai_models as any[])[0]
    : version.ai_models;

  return {
    promptContent: version.prompt_content,
    modelId: model?.model_id || "perplexity/sonar-pro",
    apiConfig: version.api_config || {},
  };
}

// Interpolate template variables
function interpolateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? value : match;
  });
}

// Call Perplexity via Vercel AI Gateway
async function callPerplexity(
  prompt: string,
  modelId: string,
  apiConfig: Record<string, unknown>
): Promise<string> {
  const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VERCEL_AI_GATEWAY_API_KEY in .env.local");
  }

  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        temperature: apiConfig.temperature ?? 0.3,
        max_tokens: apiConfig.max_tokens ?? 4000,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI Gateway error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

// Parse changelog items from AI response
interface ChangelogItem {
  headline: string;
  summary: string;
  impact_level: "minor" | "major" | "breaking";
  published_at: string | null;
}

function parseChangelogItems(response: string): ChangelogItem[] {
  // Extract JSON from response (may be wrapped in markdown code blocks)
  let jsonStr = response;

  // Remove markdown code blocks if present
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const items = JSON.parse(jsonStr.trim());
    if (!Array.isArray(items)) {
      console.warn("Response is not an array, returning empty");
      return [];
    }
    return items.filter(
      (item) =>
        item.headline &&
        item.summary &&
        ["minor", "major", "breaking"].includes(item.impact_level)
    );
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    console.error("Raw response:", response.slice(0, 500));
    return [];
  }
}

// Check for existing items to avoid duplicates
async function getExistingHeadlines(
  supabase: ReturnType<typeof getSupabase>,
  sourceName: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("changelog_items")
    .select("headline")
    .eq("source_name", sourceName);

  if (error) {
    console.error(`Error fetching existing items for ${sourceName}:`, error);
    return new Set();
  }

  return new Set(data.map((item) => item.headline));
}

// Insert new changelog items
async function insertItems(
  supabase: ReturnType<typeof getSupabase>,
  sourceName: string,
  sourceUrl: string,
  items: ChangelogItem[]
): Promise<number> {
  if (items.length === 0) return 0;

  const records = items.map((item) => ({
    source_name: sourceName,
    source_url: sourceUrl,
    headline: item.headline,
    summary: item.summary,
    impact_level: item.impact_level,
    published_at: item.published_at,
    status: "unread",
  }));

  const { error } = await supabase.from("changelog_items").insert(records);

  if (error) {
    // Handle unique constraint violation gracefully
    if (error.code === "23505") {
      console.log(`  Some items already exist, skipping duplicates`);
      return 0;
    }
    console.error(`Error inserting items for ${sourceName}:`, error);
    return 0;
  }

  return items.length;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const sourceArg = args.find((a) => a.startsWith("--source="));
  const sourceIndex = sourceArg ? parseInt(sourceArg.split("=")[1]) : null;

  console.log("📰 Changelog Ingestion Script");
  console.log("=".repeat(50));
  if (dryRun) console.log("🔍 DRY RUN MODE - no changes will be saved\n");

  const supabase = getSupabase();

  // Load prompt configuration
  console.log("Loading prompt configuration...");
  const config = await loadPromptConfig(supabase);
  console.log(`  Model: ${config.modelId}`);
  console.log(`  Temperature: ${config.apiConfig.temperature || 0.3}\n`);

  // Calculate date range (last 7 days)
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${weekAgo.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;

  // Process sources
  const sourcesToProcess =
    sourceIndex !== null ? [SOURCES[sourceIndex]] : SOURCES;

  let totalInserted = 0;
  let totalFound = 0;

  for (const source of sourcesToProcess) {
    if (!source) continue;

    console.log(`\n📦 Processing ${source.name}...`);
    console.log(`   URL: ${source.url}`);

    try {
      // Get existing headlines to dedupe
      const existingHeadlines = await getExistingHeadlines(
        supabase,
        source.name
      );
      console.log(`   Existing items: ${existingHeadlines.size}`);

      // Build prompt
      const prompt = interpolateTemplate(config.promptContent, {
        source_name: source.name,
        source_url: source.url,
        date_range: dateRange,
      });

      // Call Perplexity
      console.log("   Calling Perplexity...");
      const response = await callPerplexity(
        prompt,
        config.modelId,
        config.apiConfig
      );

      // Parse response
      const items = parseChangelogItems(response);
      console.log(`   Found ${items.length} items`);
      totalFound += items.length;

      // Filter out duplicates
      const newItems = items.filter(
        (item) => !existingHeadlines.has(item.headline)
      );
      console.log(`   New items: ${newItems.length}`);

      if (newItems.length > 0) {
        // Log items
        for (const item of newItems) {
          console.log(
            `     [${item.impact_level.toUpperCase()}] ${item.headline}`
          );
        }

        // Insert if not dry run
        if (!dryRun) {
          const inserted = await insertItems(
            supabase,
            source.name,
            source.url,
            newItems
          );
          totalInserted += inserted;
          console.log(`   ✅ Inserted ${inserted} items`);
        }
      } else {
        console.log("   ⏭️  No new items to insert");
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`   ❌ Error processing ${source.name}:`, error);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   Total items found: ${totalFound}`);
  console.log(`   Total items inserted: ${totalInserted}`);
  if (dryRun) {
    console.log(`   (DRY RUN - no items were actually inserted)`);
  }
}

main().catch(console.error);
