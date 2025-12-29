"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Request options for the generate endpoint
 */
export interface GenerateOptions {
  /** The prompt slug to use (e.g., 'brain_dump_parser', 'write_draft') */
  prompt_slug: string;

  /** Optional session ID for logging and state tracking */
  session_id?: string;

  /** Runtime variables for prompt interpolation */
  variables: Record<string, string>;

  /** Optional overrides */
  overrides?: {
    /** Override the default model */
    model_id?: string;
    /** Apply destination-specific requirements */
    destination_slug?: string;
    /** Override temperature */
    temperature?: number;
    /** Override max tokens */
    max_tokens?: number;
    /** Include/exclude specific guidelines */
    guideline_overrides?: Record<string, boolean>;
  };

  /** Enable SSE streaming (text models only) */
  stream?: boolean;
}

/**
 * Response from the generate endpoint
 */
export interface GenerateResult {
  success: boolean;

  /** Text content (for text and research models) */
  content?: string;

  /** Image data (for image models) */
  image?: {
    base64: string;
    media_type: string;
    storage_url?: string;
  };

  /** Citations (for research models like Perplexity) */
  citations?: string[];

  /** Metadata about the generation */
  meta: {
    model_used: string;
    model_type: "text" | "image" | "research";
    prompt_version?: number;
    destination_applied?: string;
    tokens_in?: number;
    tokens_out?: number;
    duration_ms: number;
  };

  /** Error message if success is false */
  error?: string;
}

/**
 * State returned by the useGenerate hook
 */
export interface GenerateState {
  /** Whether a generation is in progress */
  isLoading: boolean;
  /** The result of the last generation */
  result: GenerateResult | null;
  /** Error from the last generation */
  error: Error | null;
  /** Streamed content (when using stream: true) */
  streamedContent: string;
}

/**
 * Hook for calling the universal generate endpoint
 *
 * @example
 * ```tsx
 * const { generate, isLoading, result, error } = useGenerate();
 *
 * const handleSubmit = async () => {
 *   await generate({
 *     prompt_slug: 'brain_dump_parser',
 *     variables: { content: brainDump },
 *   });
 * };
 *
 * if (result?.success) {
 *   console.log('Generated:', result.content);
 * }
 * ```
 */
export function useGenerate() {
  const [state, setState] = useState<GenerateState>({
    isLoading: false,
    result: null,
    error: null,
    streamedContent: "",
  });

  const supabase = createClient();

  /**
   * Generate content using the universal endpoint
   */
  const generate = useCallback(
    async (options: GenerateOptions): Promise<GenerateResult | null> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        streamedContent: "",
      }));

      try {
        // Get current session for auth token
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error("NEXT_PUBLIC_SUPABASE_URL not configured");
        }

        // Handle streaming requests
        if (options.stream) {
          return await handleStreamingRequest(
            supabaseUrl,
            session.access_token,
            options,
            setState
          );
        }

        // Non-streaming request
        const response = await fetch(`${supabaseUrl}/functions/v1/generate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options),
        });

        const result: GenerateResult = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Generation failed");
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          result,
        }));

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err,
        }));
        return null;
      }
    },
    [supabase]
  );

  /**
   * Reset the state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      result: null,
      error: null,
      streamedContent: "",
    });
  }, []);

  return {
    generate,
    reset,
    isLoading: state.isLoading,
    result: state.result,
    error: state.error,
    streamedContent: state.streamedContent,
  };
}

/**
 * Handle streaming SSE response
 */
async function handleStreamingRequest(
  supabaseUrl: string,
  accessToken: string,
  options: GenerateOptions,
  setState: React.Dispatch<React.SetStateAction<GenerateState>>
): Promise<GenerateResult | null> {
  const response = await fetch(`${supabaseUrl}/functions/v1/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Generation failed: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);

        if (data === "[DONE]") {
          // Stream complete
          const result: GenerateResult = {
            success: true,
            content: fullContent,
            meta: {
              model_used: "streamed",
              model_type: "text",
              duration_ms: 0,
            },
          };

          setState((prev) => ({
            ...prev,
            isLoading: false,
            result,
          }));

          return result;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            fullContent += parsed.content;
            setState((prev) => ({
              ...prev,
              streamedContent: fullContent,
            }));
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }
  }

  // If we get here without [DONE], still return what we have
  const result: GenerateResult = {
    success: true,
    content: fullContent,
    meta: {
      model_used: "streamed",
      model_type: "text",
      duration_ms: 0,
    },
  };

  setState((prev) => ({
    ...prev,
    isLoading: false,
    result,
  }));

  return result;
}

/**
 * Convenience hook for text generation with automatic JSON parsing
 */
export function useGenerateJSON<T>() {
  const { generate, ...rest } = useGenerate();

  const generateJSON = useCallback(
    async (options: GenerateOptions): Promise<T | null> => {
      const result = await generate(options);

      if (!result?.success || !result.content) {
        return null;
      }

      try {
        // Try to parse JSON from content
        let jsonStr = result.content.trim();

        // Handle markdown code blocks
        const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }

        return JSON.parse(jsonStr) as T;
      } catch {
        console.error("Failed to parse JSON from response:", result.content);
        return null;
      }
    },
    [generate]
  );

  return {
    generateJSON,
    ...rest,
  };
}

/**
 * Convenience hook for research with citations
 */
export function useResearch() {
  const { generate, ...rest } = useGenerate();

  const research = useCallback(
    async (
      query: string,
      options?: Partial<GenerateOptions>
    ): Promise<{ content: string; citations: string[] } | null> => {
      const result = await generate({
        prompt_slug: options?.prompt_slug || "research_generator",
        variables: {
          content: query,
          ...options?.variables,
        },
        overrides: {
          model_id: "perplexity/sonar-pro",
          ...options?.overrides,
        },
      });

      if (!result?.success) {
        return null;
      }

      return {
        content: result.content || "",
        citations: result.citations || [],
      };
    },
    [generate]
  );

  return {
    research,
    ...rest,
  };
}
