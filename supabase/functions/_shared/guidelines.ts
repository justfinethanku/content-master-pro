/**
 * Brand Guidelines utilities for Edge Functions
 *
 * Loads brand guidelines from database and builds template variables.
 * Supports per-prompt defaults and runtime overrides.
 */

import { getSupabaseAdmin } from "./supabase.ts";

export interface BrandGuideline {
  id: string;
  user_id: string;
  category: string;
  slug: string;
  name: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Default image guidelines to seed for new users
 */
export const DEFAULT_IMAGE_GUIDELINES: Omit<
  BrandGuideline,
  "id" | "user_id" | "created_at" | "updated_at"
>[] = [
  {
    category: "image",
    slug: "lej_cinematic",
    name: "Cinematic Realism",
    content:
      "Hyper-realistic, photorealistic - should look like a frame from a high-budget movie",
    is_active: true,
    sort_order: 0,
  },
  {
    category: "image",
    slug: "lej_anti_corporate",
    name: "Anti-Corporate",
    content:
      "Avoid blazers, suits, offices, shared workspaces. Prefer influencer/creator aesthetic.",
    is_active: true,
    sort_order: 1,
  },
  {
    category: "image",
    slug: "lej_uniform",
    name: "LEJ Uniform",
    content:
      'Characters wear fitted crop tops with "LEJ" in bold sans-serif. Black/white or grey/black.',
    is_active: true,
    sort_order: 2,
  },
  {
    category: "image",
    slug: "lej_diversity",
    name: "Diverse Representation",
    content:
      "Prefer female protagonists. Weather-appropriate real clothing.",
    is_active: true,
    sort_order: 3,
  },
  {
    category: "image",
    slug: "lej_no_generic",
    name: "No Generic Imagery",
    content:
      "No clip art, no cheesy illustrations, no glowing brains, no stock photo poses.",
    is_active: true,
    sort_order: 4,
  },
];

/**
 * Load all guidelines for a user, grouped by category
 */
export async function loadUserGuidelines(
  userId: string
): Promise<Record<string, BrandGuideline[]>> {
  const supabase = getSupabaseAdmin();

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
 * Load guidelines for a prompt with optional overrides
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
  const supabase = getSupabaseAdmin();

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
  // If no defaults exist, include all active guidelines for that category
  const activeGuidelines = (guidelines || []).filter((g) => {
    if (overrides && g.id in overrides) {
      return overrides[g.id];
    }
    // If there are defaults, use them; otherwise include all
    if (defaultIds.size > 0) {
      return defaultIds.has(g.id);
    }
    return true; // Include all active guidelines if no defaults set
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
 * Seed default guidelines for a user if they don't have any
 */
export async function seedDefaultGuidelines(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

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
 * Build guideline variables for template interpolation
 * Convenience function that loads guidelines and formats them for use in prompts
 */
export async function buildGuidelineVariables(
  promptSetId: string,
  userId: string,
  overrides?: Record<string, boolean>
): Promise<Record<string, string>> {
  return loadPromptGuidelines(promptSetId, userId, overrides);
}
