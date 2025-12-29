/**
 * Model Configuration Loader
 *
 * Loads AI model configuration including type-specific settings
 * for text, image, and research models.
 */

import { getSupabaseAdmin } from "./supabase.ts";

export type ModelType = "text" | "image" | "research";

export interface ImageConfig {
  provider_options_key: "google" | "bfl" | "openai";
  dimension_mode: "aspect_ratio" | "pixels" | "size";
  supported_aspect_ratios?: string[];
  default_aspect_ratio?: string;
  supported_dimensions?: Array<{ width: number; height: number }>;
  default_dimensions?: { width: number; height: number };
  supported_sizes?: string[];
  default_size?: string;
  supports_negative_prompt: boolean;
  max_prompt_length?: number;
  quality_options?: string[];
  supports_inpainting?: boolean;
  supports_image_input?: boolean;
  special_capabilities?: string[];
}

export interface ResearchConfig {
  returns_citations: boolean;
  search_recency_options?: string[];
  default_recency?: string;
}

export interface ModelConfig {
  id: string;
  modelId: string;
  provider: string;
  displayName: string;
  modelType: ModelType;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  supportsImages: boolean;
  supportsStreaming: boolean;
  isAvailable: boolean;

  // Prompting guidance
  systemPromptTips: string | null;
  preferredFormat: string | null;
  formatInstructions: string | null;
  quirks: string[];

  // Type-specific config
  imageConfig: ImageConfig | null;
  researchConfig: ResearchConfig | null;

  // API specifics
  apiEndpointOverride: string | null;
  apiNotes: string | null;

  // Defaults
  defaultTemperature: number;
  defaultMaxTokens: number;
}

/**
 * Load full model configuration by model_id
 */
export async function loadModelConfig(modelId: string): Promise<ModelConfig> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_models")
    .select("*")
    .eq("model_id", modelId)
    .single();

  if (error) {
    throw new Error(`Failed to load model config for '${modelId}': ${error.message}`);
  }

  if (!data) {
    throw new Error(`Model not found: ${modelId}`);
  }

  return {
    id: data.id,
    modelId: data.model_id,
    provider: data.provider,
    displayName: data.display_name,
    modelType: data.model_type || "text",
    contextWindow: data.context_window,
    maxOutputTokens: data.max_output_tokens,
    supportsImages: data.supports_images ?? false,
    supportsStreaming: data.supports_streaming ?? true,
    isAvailable: data.is_available ?? true,

    // Prompting guidance
    systemPromptTips: data.system_prompt_tips,
    preferredFormat: data.preferred_format,
    formatInstructions: data.format_instructions,
    quirks: data.quirks || [],

    // Type-specific config
    imageConfig: data.image_config as ImageConfig | null,
    researchConfig: data.research_config as ResearchConfig | null,

    // API specifics
    apiEndpointOverride: data.api_endpoint_override,
    apiNotes: data.api_notes,

    // Defaults
    defaultTemperature: parseFloat(data.default_temperature) || 0.7,
    defaultMaxTokens: data.default_max_tokens || 4096,
  };
}

/**
 * Load all available models, optionally filtered by type
 */
export async function loadAvailableModels(
  type?: ModelType
): Promise<ModelConfig[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("ai_models")
    .select("*")
    .eq("is_available", true);

  if (type) {
    query = query.eq("model_type", type);
  }

  const { data, error } = await query.order("provider").order("display_name");

  if (error) {
    throw new Error(`Failed to load models: ${error.message}`);
  }

  return (data || []).map((d) => ({
    id: d.id,
    modelId: d.model_id,
    provider: d.provider,
    displayName: d.display_name,
    modelType: d.model_type || "text",
    contextWindow: d.context_window,
    maxOutputTokens: d.max_output_tokens,
    supportsImages: d.supports_images ?? false,
    supportsStreaming: d.supports_streaming ?? true,
    isAvailable: d.is_available ?? true,
    systemPromptTips: d.system_prompt_tips,
    preferredFormat: d.preferred_format,
    formatInstructions: d.format_instructions,
    quirks: d.quirks || [],
    imageConfig: d.image_config as ImageConfig | null,
    researchConfig: d.research_config as ResearchConfig | null,
    apiEndpointOverride: d.api_endpoint_override,
    apiNotes: d.api_notes,
    defaultTemperature: parseFloat(d.default_temperature) || 0.7,
    defaultMaxTokens: d.default_max_tokens || 4096,
  }));
}

/**
 * Get models suitable for a specific use case
 */
export async function getModelsForUseCase(
  useCase: "draft" | "research" | "image" | "fast"
): Promise<ModelConfig[]> {
  switch (useCase) {
    case "draft":
      return loadAvailableModels("text");
    case "research":
      return loadAvailableModels("research");
    case "image":
      return loadAvailableModels("image");
    case "fast":
      // Return text models that support streaming and are known to be fast
      const textModels = await loadAvailableModels("text");
      return textModels.filter(
        (m) =>
          m.supportsStreaming &&
          (m.modelId.includes("haiku") ||
            m.modelId.includes("flash") ||
            m.modelId.includes("fast"))
      );
    default:
      return loadAvailableModels();
  }
}
