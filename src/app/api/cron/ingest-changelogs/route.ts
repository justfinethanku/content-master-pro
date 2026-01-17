import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

/**
 * Cron job to ingest changelog updates from AI/dev tool sources
 *
 * Runs daily at 6:30am via Vercel cron (after newsletter sync at 6:00am)
 * Can also be triggered manually from the UI by authenticated users
 */

// Changelog sources
const SOURCES = [
  {
    name: "Anthropic",
    url: "https://docs.anthropic.com/en/release-notes/overview",
  },
  { name: "OpenAI", url: "https://platform.openai.com/docs/changelog" },
  {
    name: "Google Gemini",
    url: "https://ai.google.dev/gemini-api/docs/changelog",
  },
  { name: "xAI Grok", url: "https://docs.x.ai/docs/changelog" },
  { name: "Cursor", url: "https://www.cursor.com/changelog" },
  { name: "n8n", url: "https://docs.n8n.io/release-notes/" },
  { name: "Perplexity", url: "https://docs.perplexity.ai/changelog" },
  { name: "Meta Llama", url: "https://ai.meta.com/blog/" },
  {
    name: "Mistral",
    url: "https://docs.mistral.ai/getting-started/changelog/",
  },
  { name: "Windsurf", url: "https://codeium.com/changelog" },
];

interface ChangelogItem {
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

// Call Perplexity via Vercel AI Gateway
async function callPerplexity(
  prompt: string,
  modelId: string,
  apiConfig: Record<string, unknown>
): Promise<string> {
  const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VERCEL_AI_GATEWAY_API_KEY");
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
function parseChangelogItems(response: string): ChangelogItem[] {
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
    if (error.code === "23505") {
      // Unique constraint violation - items already exist
      return 0;
    }
    console.error(`Error inserting items for ${sourceName}:`, error);
    return 0;
  }

  return items.length;
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

  const results: Array<{
    source: string;
    found: number;
    inserted: number;
    error?: string;
  }> = [];

  try {
    const supabase = await createServiceClient();

    // Load prompt configuration
    const config = await loadPromptConfig(supabase);

    // Calculate date range (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateRange = `${weekAgo.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;

    for (const source of SOURCES) {
      try {
        // Get existing headlines to dedupe
        const existingHeadlines = await getExistingHeadlines(
          supabase,
          source.name
        );

        // Build prompt
        const prompt = interpolateTemplate(config.promptContent, {
          source_name: source.name,
          source_url: source.url,
          date_range: dateRange,
        });

        // Call Perplexity
        const response = await callPerplexity(
          prompt,
          config.modelId,
          config.apiConfig
        );

        // Parse response
        const items = parseChangelogItems(response);

        // Filter out duplicates
        const newItems = items.filter(
          (item) => !existingHeadlines.has(item.headline)
        );

        // Insert new items
        const inserted = await insertItems(
          supabase,
          source.name,
          source.url,
          newItems
        );

        results.push({
          source: source.name,
          found: items.length,
          inserted,
        });

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error(`Error processing ${source.name}:`, error);
        results.push({
          source: source.name,
          found: 0,
          inserted: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const duration = Date.now() - startTime;
    const totalFound = results.reduce((sum, r) => sum + r.found, 0);
    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const errors = results.filter((r) => r.error).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        sources: SOURCES.length,
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
