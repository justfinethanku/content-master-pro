import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";
import { fetchFeed, filterEntriesByRecency, FeedEntry } from "@/lib/feeds/parser";

/**
 * Hybrid Changelog Ingestion
 *
 * Uses two approaches:
 * 1. RSS/Atom feeds for sources that have them (deterministic)
 * 2. Perplexity API for sources without feeds (with single-domain filtering)
 *
 * Runs daily at 6:30am via Vercel cron (after newsletter sync at 6:00am)
 * Can also be triggered manually from the UI by authenticated users
 */

// Sources with working RSS/Atom feeds (deterministic)
const RSS_SOURCES = [
  // Blogs
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", type: "blog" },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", type: "blog" },

  // GitHub Releases - Anthropic
  { name: "Claude Code", url: "https://github.com/anthropics/claude-code/releases.atom", type: "release" },
  { name: "Anthropic SDK (TS)", url: "https://github.com/anthropics/anthropic-sdk-typescript/releases.atom", type: "release" },
  { name: "Anthropic SDK (Python)", url: "https://github.com/anthropics/anthropic-sdk-python/releases.atom", type: "release" },
  { name: "Claude Agent SDK", url: "https://github.com/anthropics/claude-agent-sdk-python/releases.atom", type: "release" },

  // GitHub Releases - Others
  { name: "xAI SDK", url: "https://github.com/xai-org/xai-sdk-python/releases.atom", type: "release" },
  { name: "n8n", url: "https://github.com/n8n-io/n8n/releases.atom", type: "release" },
  { name: "OpenAI SDK", url: "https://github.com/openai/openai-python/releases.atom", type: "release" },
  { name: "Meta Llama", url: "https://github.com/meta-llama/llama/releases.atom", type: "release" },
  { name: "Mistral", url: "https://github.com/mistralai/mistral-inference/releases.atom", type: "release" },
];

// Sources without RSS - use Perplexity API with domain filtering
const PERPLEXITY_SOURCES = [
  { name: "Anthropic News", url: "https://www.anthropic.com/news", domain: "anthropic.com" },
  { name: "Cursor", url: "https://www.cursor.com/changelog", domain: "cursor.com" },
  { name: "Perplexity", url: "https://perplexity.ai", domain: "perplexity.ai" },
  { name: "Windsurf", url: "https://codeium.com/changelog", domain: "codeium.com" },
  { name: "Google Gemini", url: "https://ai.google.dev/gemini-api/docs/changelog", domain: "ai.google.dev" },
];

interface ChangelogItem {
  source_name: string;
  source_url: string;
  headline: string;
  summary: string;
  impact_level: "minor" | "major" | "breaking";
  published_at: string | null;
}

// Load prompt configuration from database
async function loadPromptConfig(
  supabase: Awaited<ReturnType<typeof createServiceClient>>
) {
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
    .select(`
      id,
      prompt_content,
      api_config
    `)
    .eq("prompt_set_id", promptSet.id)
    .eq("status", "active")
    .single();

  if (versionError || !version) {
    throw new Error(
      `No active prompt version found: ${versionError?.message || "Not found"}`
    );
  }

  return {
    promptContent: version.prompt_content,
    apiConfig: (version.api_config as Record<string, unknown>) || {},
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

// Call Perplexity API with single-domain filtering
async function callPerplexity(
  prompt: string,
  domain: string,
  apiConfig: Record<string, unknown>
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PERPLEXITY_API_KEY");
  }

  const response = await fetch(
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: apiConfig.temperature ?? 0.3,
        // Perplexity-specific parameters:
        // - search_recency_filter: "week" (not "day" - too restrictive with domain filter)
        // - search_domain_filter: single domain (multiple domains use AND logic, not OR)
        search_recency_filter: "week",
        search_domain_filter: [domain],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

// Parse Perplexity response into changelog items
function parsePerplexityResponse(response: string): Omit<ChangelogItem, "source_name" | "source_url">[] {
  let jsonStr = response;

  // Remove markdown code blocks if present
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const items = JSON.parse(jsonStr.trim());
    if (!Array.isArray(items)) {
      return [];
    }
    return items.filter(
      (item) =>
        item.headline &&
        item.summary &&
        ["minor", "major", "breaking"].includes(item.impact_level)
    );
  } catch {
    console.error("Failed to parse JSON response:", response.slice(0, 500));
    return [];
  }
}

// Convert RSS entry to changelog item
function rssEntryToChangelogItem(
  entry: FeedEntry,
  sourceName: string,
  sourceUrl: string,
  sourceType: string
): ChangelogItem {
  // Determine impact level from content/title
  const text = `${entry.title} ${entry.content}`.toLowerCase();
  let impactLevel: "minor" | "major" | "breaking" = "minor";

  if (text.includes("breaking") || text.includes("deprecat") || text.includes("removed")) {
    impactLevel = "breaking";
  } else if (
    text.includes("new feature") ||
    text.includes("major") ||
    text.includes("significant") ||
    text.includes("introducing") ||
    entry.title.toLowerCase().includes("v") // Version releases are often major
  ) {
    impactLevel = "major";
  }

  // For GitHub releases, extract version from title
  const headline = entry.title.length > 100
    ? entry.title.slice(0, 97) + "..."
    : entry.title;

  // Generate summary from content
  let summary = entry.content;
  if (summary.length > 300) {
    summary = summary.slice(0, 297) + "...";
  }
  if (!summary || summary === "No content.") {
    summary = `${sourceType === "release" ? "New release" : "Update"}: ${headline}`;
  }

  return {
    source_name: sourceName,
    source_url: entry.link || sourceUrl,
    headline,
    summary,
    impact_level: impactLevel,
    published_at: entry.published?.toISOString().split("T")[0] || null,
  };
}

// Check for existing items to avoid duplicates
async function getExistingHeadlines(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
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
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  items: ChangelogItem[]
): Promise<number> {
  if (items.length === 0) return 0;

  const records = items.map((item) => ({
    source_name: item.source_name,
    source_url: item.source_url,
    headline: item.headline,
    summary: item.summary,
    impact_level: item.impact_level,
    published_at: item.published_at,
    status: "unread",
  }));

  const { error } = await supabase.from("changelog_items").insert(records);

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation - items already exist
      return 0;
    }
    console.error("Error inserting items:", error);
    return 0;
  }

  return items.length;
}

// Process RSS/Atom feeds
async function processRssFeeds(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  hoursAgo: number
): Promise<Array<{ source: string; found: number; inserted: number; error?: string }>> {
  const results = [];

  for (const source of RSS_SOURCES) {
    try {
      // Fetch and parse feed
      const feed = await fetchFeed(source.url);

      // Filter by recency
      const recentEntries = filterEntriesByRecency(feed.entries, hoursAgo);

      // Get existing headlines to dedupe
      const existingHeadlines = await getExistingHeadlines(supabase, source.name);

      // Convert to changelog items
      const items = recentEntries
        .map((entry) => rssEntryToChangelogItem(entry, source.name, source.url, source.type))
        .filter((item) => !existingHeadlines.has(item.headline));

      // Insert new items
      const inserted = await insertItems(supabase, items);

      results.push({
        source: source.name,
        found: recentEntries.length,
        inserted,
      });

      // Small delay to be nice
      await new Promise((r) => setTimeout(r, 100));
    } catch (error) {
      console.error(`Error processing RSS feed ${source.name}:`, error);
      results.push({
        source: source.name,
        found: 0,
        inserted: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

// Process Perplexity sources
async function processPerplexitySources(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  config: { promptContent: string; apiConfig: Record<string, unknown> },
  dateRange: string
): Promise<Array<{ source: string; found: number; inserted: number; error?: string }>> {
  const results = [];

  for (const source of PERPLEXITY_SOURCES) {
    try {
      // Build prompt
      const prompt = interpolateTemplate(config.promptContent, {
        source_name: source.name,
        source_url: source.url,
        date_range: dateRange,
      });

      // Call Perplexity with domain filtering
      const response = await callPerplexity(prompt, source.domain, config.apiConfig);

      // Parse response
      const parsedItems = parsePerplexityResponse(response);

      // Get existing headlines to dedupe
      const existingHeadlines = await getExistingHeadlines(supabase, source.name);

      // Convert to full changelog items
      const items: ChangelogItem[] = parsedItems
        .map((item) => ({
          source_name: source.name,
          source_url: source.url,
          ...item,
        }))
        .filter((item) => !existingHeadlines.has(item.headline));

      // Insert new items
      const inserted = await insertItems(supabase, items);

      results.push({
        source: source.name,
        found: parsedItems.length,
        inserted,
      });

      // Delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (error) {
      console.error(`Error processing Perplexity source ${source.name}:`, error);
      results.push({
        source: source.name,
        found: 0,
        inserted: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Check authorization: either CRON_SECRET or authenticated user
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  let isAuthorized = false;

  // Check CRON_SECRET first (for Vercel cron)
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true;
  }

  // Check user authentication (for manual trigger)
  if (!isAuthorized) {
    const supabaseUser = await createClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (user) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();

    // Load prompt configuration for Perplexity sources
    const config = await loadPromptConfig(supabase);

    // Calculate date range (last 7 days for Perplexity)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateRange = `${weekAgo.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;

    // Process both types of sources
    // Use 168 hours (7 days) for RSS to match Perplexity's "week" filter
    const [rssResults, perplexityResults] = await Promise.all([
      processRssFeeds(supabase, 168),
      processPerplexitySources(supabase, config, dateRange),
    ]);

    const allResults = [...rssResults, ...perplexityResults];
    const duration = Date.now() - startTime;
    const totalFound = allResults.reduce((sum, r) => sum + r.found, 0);
    const totalInserted = allResults.reduce((sum, r) => sum + r.inserted, 0);
    const errors = allResults.filter((r) => r.error).length;

    return NextResponse.json({
      success: true,
      results: allResults,
      summary: {
        rssSources: RSS_SOURCES.length,
        perplexitySources: PERPLEXITY_SOURCES.length,
        totalFound,
        totalInserted,
        errors,
        duration: `${duration}ms`,
      },
    });
  } catch (error) {
    console.error("Ingest changelog error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
