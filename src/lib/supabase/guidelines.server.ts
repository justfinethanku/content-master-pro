/**
 * Server-only Brand Guidelines utilities
 *
 * These functions use the service client and can only be called from
 * Server Components or API routes. DO NOT import in Client Components.
 */

import { createServiceClient } from "./server";
import type { BrandGuideline } from "./guidelines";
import { DEFAULT_IMAGE_GUIDELINES } from "./guidelines";

/**
 * Load all guidelines for a user, grouped by category (Server only)
 */
export async function loadUserGuidelines(
  userId: string
): Promise<Record<string, BrandGuideline[]>> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("brand_guidelines")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load guidelines: ${error.message}`);
  }

  // Group by category
  const grouped: Record<string, BrandGuideline[]> = {};
  for (const guideline of data || []) {
    if (!grouped[guideline.category]) {
      grouped[guideline.category] = [];
    }
    grouped[guideline.category].push(guideline);
  }

  return grouped;
}

/**
 * Load default guidelines for a prompt set (Server only)
 */
export async function loadPromptGuidelineDefaults(
  promptSetId: string
): Promise<string[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("prompt_guidelines")
    .select("guideline_id")
    .eq("prompt_set_id", promptSetId)
    .eq("is_default", true);

  if (error) {
    throw new Error(`Failed to load prompt guidelines: ${error.message}`);
  }

  return (data || []).map((d) => d.guideline_id);
}

/**
 * Load guidelines for a prompt with optional overrides (Server only)
 *
 * @param promptSetId - The prompt set ID
 * @param userId - The user ID
 * @param overrides - Optional map of guideline IDs to enable/disable state
 * @returns Record of category -> concatenated guidelines content
 */
export async function loadPromptGuidelines(
  promptSetId: string,
  userId: string,
  overrides?: Record<string, boolean>
): Promise<Record<string, string>> {
  const supabase = await createServiceClient();

  // Load all user guidelines
  const { data: guidelines, error: guidelinesError } = await supabase
    .from("brand_guidelines")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (guidelinesError) {
    throw new Error(`Failed to load guidelines: ${guidelinesError.message}`);
  }

  // Load default guideline IDs for this prompt
  const { data: defaults, error: defaultsError } = await supabase
    .from("prompt_guidelines")
    .select("guideline_id")
    .eq("prompt_set_id", promptSetId)
    .eq("is_default", true);

  if (defaultsError) {
    throw new Error(`Failed to load prompt defaults: ${defaultsError.message}`);
  }

  const defaultIds = new Set((defaults || []).map((d) => d.guideline_id));

  // Determine which guidelines are active
  // If overrides provided, use them; otherwise use defaults
  const activeGuidelines = (guidelines || []).filter((g) => {
    if (overrides && g.id in overrides) {
      return overrides[g.id];
    }
    return defaultIds.has(g.id);
  });

  // Group by category and concatenate content
  const result: Record<string, string> = {};
  for (const guideline of activeGuidelines) {
    const key = `${guideline.category}_guidelines`;
    if (!result[key]) {
      result[key] = "";
    }
    result[key] += `- ${guideline.content}\n`;
  }

  return result;
}

/**
 * Seed default guidelines for a user if they don't have any (Server only)
 */
export async function seedDefaultGuidelines(userId: string): Promise<void> {
  const supabase = await createServiceClient();

  // Check if user already has guidelines
  const { count } = await supabase
    .from("brand_guidelines")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) {
    return; // User already has guidelines
  }

  // Insert default guidelines
  const { error } = await supabase.from("brand_guidelines").insert(
    DEFAULT_IMAGE_GUIDELINES.map((g) => ({
      ...g,
      user_id: userId,
    }))
  );

  if (error) {
    throw new Error(`Failed to seed default guidelines: ${error.message}`);
  }
}

/**
 * Build guideline variables for template interpolation (Server only)
 * Convenience function that loads guidelines and formats them for use in prompts
 */
export async function buildGuidelineVariables(
  promptSetId: string,
  userId: string,
  overrides?: Record<string, boolean>
): Promise<Record<string, string>> {
  return loadPromptGuidelines(promptSetId, userId, overrides);
}
