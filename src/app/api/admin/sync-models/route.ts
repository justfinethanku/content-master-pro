import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const AI_GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

interface GatewayModel {
  id: string;
  object: string;
  name?: string;
  description?: string;
  type?: string; // "language" | "image" | "embedding"
  tags?: string[];
  context_window?: number;
  max_tokens?: number;
  pricing?: Record<string, unknown>;
  released?: string;
  owned_by?: string;
  created?: number;
}

interface GatewayResponse {
  object: string;
  data: GatewayModel[];
}

function extractProvider(modelId: string): string {
  return modelId.split("/")[0] || "unknown";
}

/** Infer our model_type from gateway data */
function inferModelType(model: GatewayModel): "text" | "image" | "research" {
  if (model.type === "image") return "image";
  const provider = extractProvider(model.id);
  if (provider === "perplexity") return "research";
  return "text";
}

/** Infer supports_thinking from tags */
function inferSupportsThinking(tags: string[] | undefined): boolean {
  return tags?.includes("reasoning") ?? false;
}

/** Infer supports_images from tags or type */
function inferSupportsImages(model: GatewayModel): boolean {
  if (model.type === "image") return true;
  return model.tags?.includes("vision") ?? false;
}

/** Infer supports_streaming — image models typically don't stream */
function inferSupportsStreaming(model: GatewayModel): boolean {
  return model.type !== "image";
}

/** Parse release date string to ISO timestamp */
function parseReleaseDate(released: string | undefined): string | null {
  if (!released) return null;
  try {
    return new Date(released).toISOString();
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    // Check auth and admin role
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Fetch models from Vercel AI Gateway
    const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "VERCEL_AI_GATEWAY_API_KEY not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(AI_GATEWAY_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Gateway API error: ${response.status}` },
        { status: 502 }
      );
    }

    const gatewayData = (await response.json()) as GatewayResponse;

    // Exclude embedding models
    const nonEmbedding = gatewayData.data.filter(
      (m) => m.type !== "embedding"
    );
    const excludedCount =
      gatewayData.data.length - nonEmbedding.length;

    // Use service client for upsert (bypasses RLS)
    const serviceClient = await createServiceClient();

    // Get existing models to track new vs updated
    const { data: existingModels } = await serviceClient
      .from("ai_models")
      .select("model_id");

    const existingIds = new Set(
      existingModels?.map((m) => m.model_id) || []
    );

    let newCount = 0;
    let updatedCount = 0;
    const batchSize = 50;

    // Separate new vs existing
    const newModels = nonEmbedding.filter((m) => !existingIds.has(m.id));
    const existingToUpdate = nonEmbedding.filter((m) =>
      existingIds.has(m.id)
    );

    // Step 1: Insert new models (is_available defaults to false via migration)
    if (newModels.length > 0) {
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
          supports_images: inferSupportsImages(m),
          supports_streaming: inferSupportsStreaming(m),
          supports_thinking: inferSupportsThinking(m.tags),
          pricing: m.pricing || null,
          tags: m.tags || [],
          released_at: parseReleaseDate(m.released),
          gateway_type: m.type || null,
          // is_available defaults to false via migration
        }));

        const { error: insertError } = await serviceClient
          .from("ai_models")
          .insert(rows);

        if (insertError) {
          return NextResponse.json(
            { error: `Insert failed: ${insertError.message}` },
            { status: 500 }
          );
        }
      }
      newCount = newModels.length;
    }

    // Step 2: Update existing models — only gateway-sourced fields
    for (const m of existingToUpdate) {
      const { error: updateError } = await serviceClient
        .from("ai_models")
        .update({
          display_name: m.name || m.id.split("/").pop() || m.id,
          description: m.description || null,
          context_window: m.context_window || null,
          max_output_tokens: m.max_tokens || null,
          supports_images: inferSupportsImages(m),
          supports_streaming: inferSupportsStreaming(m),
          supports_thinking: inferSupportsThinking(m.tags),
          pricing: m.pricing || null,
          tags: m.tags || [],
          released_at: parseReleaseDate(m.released),
          gateway_type: m.type || null,
          // Preserved: is_available, model_type, system_prompt_tips,
          // preferred_format, format_instructions, quirks, api_notes,
          // default_temperature, default_max_tokens, image_config, research_config
        })
        .eq("model_id", m.id);

      if (updateError) {
        console.error(`Failed to update ${m.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalFromApi: gatewayData.data.length,
      excluded: excludedCount,
      synced: nonEmbedding.length,
      newModels: newCount,
      updatedModels: updatedCount,
    });
  } catch (error) {
    console.error("Model sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
