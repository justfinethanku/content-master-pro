/**
 * Prompt loading and interpolation utilities for Next.js
 *
 * Rule 3: Database-Driven Prompt Management
 * All prompts must be loaded from the database, never hardcoded.
 *
 * This mirrors the Edge Function utility in supabase/functions/_shared/prompts.ts
 */

import { createServiceClient } from "./server";

export interface PromptConfig {
  promptSetId: string;
  promptVersionId: string;
  slug: string;
  name: string;
  promptContent: string;
  modelId: string;
  modelProvider: string;
  modelDisplayName: string;
  apiConfig: {
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  };
}

/**
 * Load the active prompt configuration for a given slug
 */
export async function loadActivePromptConfig(
  slug: string
): Promise<PromptConfig> {
  const supabase = await createServiceClient();

  // First get the prompt set
  const { data: promptSet, error: setError } = await supabase
    .from("prompt_sets")
    .select("id, slug, name")
    .eq("slug", slug)
    .single();

  if (setError || !promptSet) {
    throw new Error(
      `Failed to load prompt set '${slug}': ${setError?.message || "Not found"}`
    );
  }

  // Then get the active version with model info
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
      `No active prompt version found for '${slug}': ${versionError?.message || "Not found"}`
    );
  }

  // ai_models can be an object or array depending on the join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = Array.isArray(version.ai_models)
    ? (version.ai_models as any[])[0]
    : version.ai_models;

  return {
    promptSetId: promptSet.id,
    promptVersionId: version.id,
    slug: promptSet.slug,
    name: promptSet.name,
    promptContent: version.prompt_content,
    modelId: model?.model_id || "anthropic/claude-sonnet-4-5",
    modelProvider: model?.provider || "anthropic",
    modelDisplayName: model?.display_name || "Claude Sonnet 4.5",
    apiConfig: version.api_config || {},
  };
}

/**
 * Interpolate template variables in prompt content
 *
 * Supports {{variable_name}} syntax
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? value : match;
  });
}

/**
 * Build a complete prompt from config and variables
 */
export function buildPrompt(
  config: PromptConfig,
  variables: Record<string, string | undefined>
): string {
  return interpolateTemplate(config.promptContent, variables);
}
