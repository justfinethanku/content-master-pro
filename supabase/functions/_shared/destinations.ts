/**
 * Destination Configuration Loader
 *
 * Loads platform-specific output configuration (YouTube, TikTok, Substack, etc.)
 * for tailoring content to each destination's requirements.
 */

import { getSupabaseAdmin } from "./supabase.ts";

export type DestinationCategory = "video" | "social" | "newsletter";

export interface VideoSpecs {
  aspect_ratio: string;
  max_duration_seconds?: number;
  thumbnail_size?: string;
}

export interface TextSpecs {
  max_characters?: number | null;
  supports_markdown?: boolean;
  supports_html?: boolean;
  supports_line_breaks?: boolean;
  supports_threads?: boolean;
  optimal_length?: number;
  header_image_size?: string;
}

export interface DestinationSpecs {
  video?: VideoSpecs;
  text?: TextSpecs;
}

export interface DestinationConfig {
  id: string;
  slug: string;
  name: string;
  category: DestinationCategory;
  specs: DestinationSpecs;
  promptInstructions: string | null;
  toneModifiers: string[];
  isActive: boolean;
  sortOrder: number;
}

/**
 * Load destination configuration by slug
 */
export async function loadDestination(slug: string): Promise<DestinationConfig> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    throw new Error(`Failed to load destination '${slug}': ${error.message}`);
  }

  if (!data) {
    throw new Error(`Destination not found: ${slug}`);
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    category: data.category as DestinationCategory,
    specs: data.specs as DestinationSpecs,
    promptInstructions: data.prompt_instructions,
    toneModifiers: data.tone_modifiers || [],
    isActive: data.is_active,
    sortOrder: data.sort_order,
  };
}

/**
 * Load all active destinations, optionally filtered by category
 */
export async function loadDestinations(
  category?: DestinationCategory
): Promise<DestinationConfig[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("destinations")
    .select("*")
    .eq("is_active", true);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query.order("sort_order");

  if (error) {
    throw new Error(`Failed to load destinations: ${error.message}`);
  }

  return (data || []).map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    category: d.category as DestinationCategory,
    specs: d.specs as DestinationSpecs,
    promptInstructions: d.prompt_instructions,
    toneModifiers: d.tone_modifiers || [],
    isActive: d.is_active,
    sortOrder: d.sort_order,
  }));
}

/**
 * Get the aspect ratio for a destination (for image generation)
 */
export function getDestinationAspectRatio(
  destination: DestinationConfig
): string | null {
  if (destination.specs.video?.aspect_ratio) {
    return destination.specs.video.aspect_ratio;
  }
  return null;
}

/**
 * Get character limit for a text destination
 */
export function getDestinationCharacterLimit(
  destination: DestinationConfig
): number | null {
  return destination.specs.text?.max_characters ?? null;
}

/**
 * Build destination requirements string for prompt injection
 */
export function buildDestinationRequirements(
  destination: DestinationConfig
): string {
  const parts: string[] = [];

  // Add platform name
  parts.push(`Platform: ${destination.name}`);

  // Add specs summary
  if (destination.category === "video") {
    const video = destination.specs.video;
    if (video) {
      parts.push(`Format: ${video.aspect_ratio} video`);
      if (video.max_duration_seconds) {
        parts.push(`Max duration: ${video.max_duration_seconds} seconds`);
      }
    }
  } else if (destination.specs.text) {
    const text = destination.specs.text;
    if (text.max_characters) {
      parts.push(`Character limit: ${text.max_characters}`);
    }
    if (text.supports_markdown) {
      parts.push("Supports: Markdown formatting");
    }
  }

  // Add prompt instructions
  if (destination.promptInstructions) {
    parts.push("");
    parts.push("Platform-specific instructions:");
    parts.push(destination.promptInstructions);
  }

  // Add tone modifiers
  if (destination.toneModifiers.length > 0) {
    parts.push("");
    parts.push(`Tone: ${destination.toneModifiers.join(", ")}`);
  }

  return parts.join("\n");
}
