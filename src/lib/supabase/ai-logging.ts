/**
 * AI Call Logging Utility for Next.js
 *
 * Rule 13: AI Call Logging
 * Every AI call must be logged to the ai_call_logs table.
 */

import { createClient } from "./server";

export interface AICallLogParams {
  sessionId?: string;
  promptSetSlug: string;
  fullPrompt: string;
  fullResponse: string;
  modelId: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs: number;
  errorMessage?: string;
}

/**
 * Log an AI call to the ai_call_logs table
 *
 * This function is designed to not throw errors to avoid
 * breaking the main response flow if logging fails.
 */
export async function logAICall(params: AICallLogParams): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase.from("ai_call_logs").insert({
      session_id: params.sessionId || null,
      prompt_set_slug: params.promptSetSlug,
      full_prompt: params.fullPrompt,
      full_response: params.fullResponse,
      model_id: params.modelId,
      tokens_in: params.tokensIn || null,
      tokens_out: params.tokensOut || null,
      duration_ms: params.durationMs,
      error_message: params.errorMessage || null,
    });
  } catch (error) {
    // Log errors but don't throw - we don't want logging failures
    // to break the main response flow
    console.error("Failed to log AI call:", error);
  }
}
