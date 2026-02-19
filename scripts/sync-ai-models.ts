/**
 * AI Model Sync Script
 *
 * Fetches models from Vercel AI Gateway and syncs to database.
 * Rich metadata (description, pricing, tags, etc.) is auto-populated.
 *
 * Usage:
 *   npx tsx scripts/sync-ai-models.ts            # Full sync
 *   npx tsx scripts/sync-ai-models.ts --dry-run   # Preview only
 */

import { createClient } from "@supabase/supabase-js";
import * as path from "path";

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
try {
  process.loadEnvFile(envPath);
} catch {
  console.error(`Failed to load ${envPath}. Ensure .env.local exists.`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY!;
const AI_GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

interface GatewayModel {
  id: string;
  object: string;
  name?: string;
  description?: string;
  type?: string;
  tags?: string[];
  context_window?: number;
  max_tokens?: number;
  pricing?: Record<string, unknown>;
  released?: string;
  owned_by?: string;
}

interface GatewayResponse {
  object: string;
  data: GatewayModel[];
}

function extractProvider(modelId: string): string {
  return modelId.split("/")[0] || "unknown";
}

function inferModelType(model: GatewayModel): "text" | "image" | "research" {
  if (model.type === "image") return "image";
  if (extractProvider(model.id) === "perplexity") return "research";
  return "text";
}

function parseReleaseDate(released: string | undefined): string | null {
  if (!released) return null;
  try {
    return new Date(released).toISOString();
  } catch {
    return null;
  }
}

const isDryRun = process.argv.includes("--dry-run");

async function fetchModels(): Promise<GatewayModel[]> {
  console.log("Fetching models from Vercel AI Gateway...");

  const response = await fetch(AI_GATEWAY_MODELS_URL, {
    headers: { Authorization: `Bearer ${AI_GATEWAY_API_KEY}` },
  });

  if (!response.ok) {
    throw new Error(`Gateway API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GatewayResponse;
  return data.data;
}

async function main() {
  console.log(`\nAI Model Sync ${isDryRun ? "(DRY RUN)" : ""}\n`);

  const allModels = await fetchModels();

  // Filter out embedding models
  const models = allModels.filter((m) => m.type !== "embedding");
  const excluded = allModels.length - models.length;

  console.log(`Total from API: ${allModels.length}`);
  console.log(`Excluded (embedding): ${excluded}`);
  console.log(`To sync: ${models.length}`);

  // Group by type for summary
  const byType: Record<string, number> = {};
  for (const m of models) {
    const t = m.type || "unknown";
    byType[t] = (byType[t] || 0) + 1;
  }
  console.log(`\nBy type: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(", ")}`);

  if (isDryRun) {
    console.log("\nModels that would be synced:\n");

    // Group by provider
    const byProvider: Record<string, GatewayModel[]> = {};
    for (const m of models) {
      const p = extractProvider(m.id);
      if (!byProvider[p]) byProvider[p] = [];
      byProvider[p].push(m);
    }

    for (const [provider, providerModels] of Object.entries(byProvider).sort()) {
      console.log(`  ${provider} (${providerModels.length}):`);
      for (const m of providerModels.slice(0, 10)) {
        const tags = m.tags?.length ? ` [${m.tags.join(", ")}]` : "";
        console.log(`    - ${m.name || m.id}${tags}`);
      }
      if (providerModels.length > 10) {
        console.log(`    ... and ${providerModels.length - 10} more`);
      }
    }
    return;
  }

  // Connect to Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get existing models
  const { data: existingModels, error: fetchError } = await supabase
    .from("ai_models")
    .select("model_id");

  if (fetchError) throw new Error(`Failed to fetch existing: ${fetchError.message}`);

  const existingIds = new Set(existingModels?.map((m) => m.model_id) || []);

  const newModels = models.filter((m) => !existingIds.has(m.id));
  const toUpdate = models.filter((m) => existingIds.has(m.id));

  console.log(`\nAlready in DB: ${existingIds.size}`);
  console.log(`New to add: ${newModels.length}`);
  console.log(`To update: ${toUpdate.length}`);

  // Insert new models (is_available defaults to false)
  if (newModels.length > 0) {
    console.log("\nInserting new models...");
    const batchSize = 50;
    for (let i = 0; i < newModels.length; i += batchSize) {
      const batch = newModels.slice(i, i + batchSize);
      const rows = batch.map((m) => ({
        model_id: m.id,
        provider: extractProvider(m.id),
        display_name: m.name || m.id.split("/").pop() || m.id,
        description: m.description || null,
        model_type: inferModelType(m),
        context_window: m.context_window || null,
        max_output_tokens: m.max_tokens || null,
        supports_images: m.type === "image" || (m.tags?.includes("vision") ?? false),
        supports_streaming: m.type !== "image",
        supports_thinking: m.tags?.includes("reasoning") ?? false,
        pricing: m.pricing || null,
        tags: m.tags || [],
        released_at: parseReleaseDate(m.released),
        gateway_type: m.type || null,
      }));

      const { error } = await supabase.from("ai_models").insert(rows);
      if (error) throw new Error(`Insert failed: ${error.message}`);
    }

    console.log(`Added ${newModels.length} new models`);
    for (const m of newModels) {
      console.log(`  + ${m.id}`);
    }
  }

  // Update existing models (gateway fields only)
  if (toUpdate.length > 0) {
    console.log("\nUpdating existing models...");
    let updated = 0;
    for (const m of toUpdate) {
      const { error } = await supabase
        .from("ai_models")
        .update({
          display_name: m.name || m.id.split("/").pop() || m.id,
          description: m.description || null,
          context_window: m.context_window || null,
          max_output_tokens: m.max_tokens || null,
          supports_images: m.type === "image" || (m.tags?.includes("vision") ?? false),
          supports_streaming: m.type !== "image",
          supports_thinking: m.tags?.includes("reasoning") ?? false,
          pricing: m.pricing || null,
          tags: m.tags || [],
          released_at: parseReleaseDate(m.released),
          gateway_type: m.type || null,
        })
        .eq("model_id", m.id);

      if (error) {
        console.error(`  Failed to update ${m.id}: ${error.message}`);
      } else {
        updated++;
      }
    }
    console.log(`Updated ${updated} existing models`);
  }

  // Check for models in DB not in API
  const apiIds = new Set(models.map((m) => m.id));
  const stale = [...existingIds].filter((id) => !apiIds.has(id));
  if (stale.length > 0) {
    console.log(`\n${stale.length} models in DB not found in API (keeping as-is):`);
    for (const id of stale) {
      console.log(`  ? ${id}`);
    }
  }

  console.log("\nSync complete!");
}

main().catch((err) => {
  console.error("\nSync failed:", err);
  process.exit(1);
});
