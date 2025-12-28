/**
 * Client-safe Brand Guidelines utilities for Next.js
 *
 * Loads brand guidelines from database and manages CRUD operations.
 * For server-only functions, import from "./guidelines.server"
 */

import { createClient } from "./client";

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

export interface PromptGuidelineDefault {
  id: string;
  prompt_set_id: string;
  guideline_id: string;
  is_default: boolean;
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
 * Load guidelines for a user using the browser client
 */
export async function loadUserGuidelinesClient(): Promise<
  Record<string, BrandGuideline[]>
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("brand_guidelines")
    .select("*")
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
 * Create a new guideline
 */
export async function createGuideline(
  guideline: Omit<BrandGuideline, "id" | "created_at" | "updated_at">
): Promise<BrandGuideline> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("brand_guidelines")
    .insert(guideline)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create guideline: ${error.message}`);
  }

  return data;
}

/**
 * Update a guideline
 */
export async function updateGuideline(
  id: string,
  updates: Partial<
    Omit<BrandGuideline, "id" | "user_id" | "created_at" | "updated_at">
  >
): Promise<BrandGuideline> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("brand_guidelines")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update guideline: ${error.message}`);
  }

  return data;
}

/**
 * Delete a guideline
 */
export async function deleteGuideline(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("brand_guidelines")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete guideline: ${error.message}`);
  }
}

/**
 * Set default guidelines for a prompt set
 */
export async function setPromptGuidelineDefaults(
  promptSetId: string,
  guidelineIds: string[]
): Promise<void> {
  const supabase = createClient();

  // Delete existing defaults
  await supabase
    .from("prompt_guidelines")
    .delete()
    .eq("prompt_set_id", promptSetId);

  // Insert new defaults
  if (guidelineIds.length > 0) {
    const { error } = await supabase.from("prompt_guidelines").insert(
      guidelineIds.map((guidelineId) => ({
        prompt_set_id: promptSetId,
        guideline_id: guidelineId,
        is_default: true,
      }))
    );

    if (error) {
      throw new Error(`Failed to set prompt defaults: ${error.message}`);
    }
  }
}
