/**
 * Universal Generate Edge Function
 *
 * One endpoint to rule them all - handles text, image, and research generation
 * by loading configuration from the database and routing to the appropriate handler.
 *
 * POST /functions/v1/generate
 *
 * Request:
 * {
 *   prompt_slug: string;           // 'write_draft', 'generate_headlines', etc.
 *   session_id?: string;           // For logging and state tracking
 *   variables: Record<string, string>;  // Runtime variables for interpolation
 *   overrides?: {
 *     model_id?: string;           // Override default model
 *     destination_slug?: string;   // Apply destination requirements
 *     temperature?: number;        // Override temperature
 *     max_tokens?: number;         // Override max tokens
 *     guideline_overrides?: Record<string, boolean>;
 *   };
 *   stream?: boolean;              // Enable SSE streaming (text models only)
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { experimental_generateImage as generateImage, createGateway } from "npm:ai@^6.0.0";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^3.0.0";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getSupabaseAdmin, getSupabaseClient, getAuthenticatedUser } from "../_shared/supabase.ts";
import { loadActivePromptConfig, interpolateTemplate } from "../_shared/prompts.ts";
import { loadModelConfig, type ModelConfig, type ImageConfig } from "../_shared/models.ts";
import { loadDestination, buildDestinationRequirements, getDestinationAspectRatio, type DestinationConfig } from "../_shared/destinations.ts";
import { buildGuidelineVariables } from "../_shared/guidelines.ts";
import { resolveVariables } from "../_shared/variables.ts";

// Types
interface GenerateRequest {
  prompt_slug: string;
  session_id?: string;
  variables: Record<string, string>;
  overrides?: {
    model_id?: string;
    destination_slug?: string;
    temperature?: number;
    max_tokens?: number;
    guideline_overrides?: Record<string, boolean>;
    aspect_ratio?: string;
  };
  reference_image?: string; // base64-encoded reference image
  stream?: boolean;
}

interface GenerateResponse {
  success: boolean;
  content?: string;
  reasoning?: string;
  image?: {
    base64: string;
    media_type: string;
    storage_url?: string;
    storage_failed?: boolean;
  };
  citations?: string[];
  meta: {
    model_used: string;
    model_type: "text" | "image" | "research";
    prompt_version?: number;
    destination_applied?: string;
    tokens_in?: number;
    tokens_out?: number;
    duration_ms: number;
    reasoning_enabled?: boolean;
    reasoning_budget?: number;
  };
  debug?: {
    assembled_system_prompt: string;
    assembled_user_prompt: string;
    model_config_applied: object;
    destination_config_applied: object | null;
    guidelines_included: string[];
    resolved_variables: string[];
    manual_variables: string[];
  };
  error?: string;
}

// Main handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const includeDebug = req.headers.get("x-debug") === "true";

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const supabase = getSupabaseClient(authHeader);
    const user = await getAuthenticatedUser(supabase);
    if (!user) {
      throw new Error("Invalid or expired token");
    }

    // Parse request
    const body: GenerateRequest = await req.json();
    const { prompt_slug, session_id, variables, overrides, reference_image, stream } = body;

    if (!prompt_slug) {
      throw new Error("prompt_slug is required");
    }

    // 1. Load prompt template
    const promptConfig = await loadActivePromptConfig(prompt_slug);

    // 2. Determine model (override > prompt default)
    const modelId = overrides?.model_id ?? promptConfig.modelId;
    const modelConfig = await loadModelConfig(modelId);

    // 3. Load destination (if specified)
    let destinationConfig: DestinationConfig | null = null;
    if (overrides?.destination_slug) {
      destinationConfig = await loadDestination(overrides.destination_slug);
    }

    // 4. Load user's guidelines
    const guidelineVars = await buildGuidelineVariables(
      promptConfig.promptSetId,
      user.id,
      overrides?.guideline_overrides
    );

    // 5. Resolve variables found in the prompt template
    // Variables are determined by what's in the template ({{variable_name}}), not by checkbox selections
    let resolvedVars: Record<string, string> = {};
    if (session_id) {
      try {
        resolvedVars = await resolveVariables(
          promptConfig.promptContent,
          session_id,
          user.id,
          variables // Manual variables take precedence
        );
      } catch (resolveError) {
        console.warn("Variable resolution failed, using manual variables:", resolveError);
      }
    }

    // 6. Assemble system prompt with all variables
    // For image models: template = system instructions only (user content comes via userMessage)
    // For text/research: template may contain {{content}} and other user variables
    const USER_CONTENT_KEYS = new Set(["content", "input", "prompt"]);
    const isImageModel = modelConfig.modelType === "image";

    // For image models, strip user content variables so the template stays as pure instructions
    const templateVars: Record<string, string | undefined> = {
      ...resolvedVars,
      ...(isImageModel
        ? Object.fromEntries(
            Object.entries(variables || {}).filter(([k]) => !USER_CONTENT_KEYS.has(k))
          )
        : variables),
      model_instructions: modelConfig.systemPromptTips || "",
      model_format: modelConfig.formatInstructions || "",
      destination_requirements: destinationConfig
        ? buildDestinationRequirements(destinationConfig)
        : "",
      destination_specs: destinationConfig
        ? JSON.stringify(destinationConfig.specs)
        : "",
      ...guidelineVars,
    };

    const systemPrompt = interpolateTemplate(promptConfig.promptContent, templateVars);

    // 7. Build user message from runtime variables
    const userMessage = buildUserMessage({ ...resolvedVars, ...variables });

    // 8. Determine API parameters
    const temperature =
      overrides?.temperature ??
      promptConfig.apiConfig.temperature ??
      modelConfig.defaultTemperature;
    const maxTokens =
      overrides?.max_tokens ??
      promptConfig.apiConfig.max_tokens ??
      modelConfig.defaultMaxTokens;

    // Determine reasoning parameters (only if model supports it)
    // "adaptive" = Claude 4.6+ adaptive thinking (model decides when/how much to think)
    // true = legacy budget-based thinking (deprecated in 4.6+)
    const thinkingMode = modelConfig.supportsThinking
      ? promptConfig.apiConfig.thinking ?? (promptConfig.apiConfig.reasoning_enabled ? "budget" : null)
      : null;
    const reasoningEnabled = thinkingMode === "budget";
    const reasoningBudget =
      reasoningEnabled
        ? (promptConfig.apiConfig.reasoning_budget ?? 10000)
        : undefined;

    // Debug logging for API parameters
    console.log("[generate] API params:", {
      prompt_slug,
      model_id: modelId,
      model_type: modelConfig.modelType,
      temperature,
      maxTokens,
      thinkingMode,
      reasoningEnabled,
      reasoningBudget,
      "promptConfig.apiConfig": promptConfig.apiConfig,
      "modelConfig.defaultMaxTokens": modelConfig.defaultMaxTokens,
      "modelConfig.supportsThinking": modelConfig.supportsThinking,
    });

    // 9. Call AI based on model type
    let result: AICallResult;
    switch (modelConfig.modelType) {
      case "text":
        if (stream) {
          return await callTextModelStreaming({
            modelId,
            systemPrompt,
            userMessage,
            temperature,
            maxTokens,
            sessionId: session_id,
            promptSlug: prompt_slug,
            thinkingMode,
            reasoningEnabled,
            reasoningBudget,
          });
        }
        result = await callTextModel({
          modelId,
          systemPrompt,
          userMessage,
          temperature,
          maxTokens,
          thinkingMode,
          reasoningEnabled,
          reasoningBudget,
        });
        break;

      case "image":
        result = await callImageModelSDK({
          modelId,
          prompt: userMessage,
          systemPrompt,
          imageConfig: modelConfig.imageConfig!,
          aspectRatio: overrides?.aspect_ratio
            || (destinationConfig ? getDestinationAspectRatio(destinationConfig) : null),
          referenceImage: reference_image,
        });
        break;

      case "research":
        result = await callResearchModel({
          modelId,
          systemPrompt,
          userMessage,
          temperature,
          maxTokens,
        });
        break;

      default:
        throw new Error(`Unknown model type: ${modelConfig.modelType}`);
    }

    const durationMs = Date.now() - startTime;

    // 9b. Store generated image in Supabase Storage (if image result)
    let imageStorageUrl: string | null = null;
    let imageStorageFailed = false;
    if (modelConfig.modelType === "image" && result.image) {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        const imageId = crypto.randomUUID();
        const ext = result.image.media_type === "image/jpeg" ? "jpg" : "png";
        const storagePath = `${user.id}/${imageId}.${ext}`;

        // Decode base64 and upload
        const bytes = decodeBase64(result.image.base64);

        const { error: uploadError } = await supabaseAdmin.storage
          .from("generated-images")
          .upload(storagePath, bytes, {
            contentType: result.image.media_type,
            upsert: false,
          });

        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage
            .from("generated-images")
            .getPublicUrl(storagePath);

          imageStorageUrl = urlData?.publicUrl || null;

          // Save metadata to generated_images table
          await supabaseAdmin.from("generated_images").insert({
            user_id: user.id,
            session_id: session_id || null,
            storage_path: storagePath,
            public_url: imageStorageUrl,
            prompt: userMessage,
            model_used: modelId,
            aspect_ratio: overrides?.aspect_ratio || modelConfig.imageConfig?.default_aspect_ratio || "1:1",
            mime_type: result.image.media_type,
            file_size: bytes.length,
            metadata: {
              reference_image_used: !!reference_image,
              duration_ms: durationMs,
            },
          });

          // Immutably attach storage URL to result for client
          result = {
            ...result,
            image: { ...result.image, storage_url: imageStorageUrl },
          };
        } else {
          console.warn("Failed to upload image to storage:", uploadError);
          imageStorageFailed = true;
        }
      } catch (storageError) {
        console.warn("Image storage failed (non-fatal):", storageError);
        imageStorageFailed = true;
      }
    }

    // 10. Log the call
    await logAICall({
      sessionId: session_id,
      promptSlug: prompt_slug,
      modelId,
      fullPrompt: `${systemPrompt}\n\n${userMessage}`,
      fullResponse: JSON.stringify(result),
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      durationMs,
    });

    // 11. Build response
    const response: GenerateResponse = {
      success: true,
      meta: {
        model_used: modelId,
        model_type: modelConfig.modelType,
        destination_applied: overrides?.destination_slug,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        duration_ms: durationMs,
        reasoning_enabled: reasoningEnabled,
        reasoning_budget: reasoningBudget,
      },
    };

    // Add type-specific output
    if (modelConfig.modelType === "image" && result.image) {
      response.image = imageStorageFailed
        ? { ...result.image, storage_failed: true }
        : result.image;
    } else if (modelConfig.modelType === "research") {
      response.content = result.content;
      response.citations = result.citations;
    } else {
      response.content = result.content;
      // Include reasoning if present
      if (result.reasoning) {
        response.reasoning = result.reasoning;
      }
    }

    // Add debug info if requested
    if (includeDebug) {
      response.debug = {
        assembled_system_prompt: systemPrompt,
        assembled_user_prompt: userMessage,
        model_config_applied: {
          model_type: modelConfig.modelType,
          temperature,
          max_tokens: maxTokens,
          system_prompt_tips: modelConfig.systemPromptTips,
        },
        destination_config_applied: destinationConfig
          ? {
              slug: destinationConfig.slug,
              prompt_instructions: destinationConfig.promptInstructions,
            }
          : null,
        guidelines_included: Object.keys(guidelineVars),
        resolved_variables: Object.keys(resolvedVars),
        manual_variables: Object.keys(variables || {}),
      };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("Generate error:", errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        meta: {
          model_used: "unknown",
          model_type: "text",
          duration_ms: durationMs,
        },
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function buildUserMessage(variables: Record<string, string>): string {
  // If there's a specific 'content' or 'input' variable, use that as the main message
  if (variables.content) return variables.content;
  if (variables.input) return variables.input;
  if (variables.prompt) return variables.prompt;

  // Otherwise, format all variables
  const parts: string[] = [];
  for (const [key, value] of Object.entries(variables)) {
    if (value && value.trim()) {
      parts.push(`${key}:\n${value}`);
    }
  }
  return parts.join("\n\n");
}

// ============================================================================
// AI Call Types and Functions
// ============================================================================

interface AICallResult {
  content?: string;
  reasoning?: string;
  image?: {
    base64: string;
    media_type: string;
    storage_url?: string;
  };
  citations?: string[];
  tokensIn?: number;
  tokensOut?: number;
}

/**
 * Call text model (Claude, Gemini, etc.)
 */
async function callTextModel(params: {
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  thinkingMode?: string | null;
  reasoningEnabled?: boolean;
  reasoningBudget?: number;
}): Promise<AICallResult> {
  const { modelId, systemPrompt, userMessage, temperature, maxTokens, thinkingMode, reasoningEnabled, reasoningBudget } = params;

  const gatewayApiKey = Deno.env.get("VERCEL_AI_GATEWAY_API_KEY");
  if (!gatewayApiKey) {
    throw new Error("VERCEL_AI_GATEWAY_API_KEY not configured");
  }

  // Build request body
  const requestBody: Record<string, unknown> = {
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
  };

  // Add reasoning/thinking based on mode
  // Note: When reasoning/thinking is enabled, temperature must be omitted
  if (thinkingMode === "adaptive") {
    // Claude 4.6+ adaptive thinking — model decides when and how much to think
    requestBody.reasoning = { type: "adaptive" };
    // Don't set temperature when thinking is enabled
  } else if (reasoningEnabled && reasoningBudget && reasoningBudget > 0) {
    // Legacy budget-based thinking (deprecated in 4.6+)
    requestBody.reasoning = {
      enabled: true,
      budget_tokens: reasoningBudget,
    };
    // Don't set temperature when reasoning is enabled
  } else {
    requestBody.temperature = temperature;
  }

  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;

  return {
    content: message?.content || "",
    reasoning: message?.reasoning || undefined,
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}

/**
 * Call text model with SSE streaming
 */
async function callTextModelStreaming(params: {
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  sessionId?: string;
  promptSlug: string;
  thinkingMode?: string | null;
  reasoningEnabled?: boolean;
  reasoningBudget?: number;
}): Promise<Response> {
  const { modelId, systemPrompt, userMessage, temperature, maxTokens, sessionId, promptSlug, thinkingMode, reasoningEnabled, reasoningBudget } = params;

  const gatewayApiKey = Deno.env.get("VERCEL_AI_GATEWAY_API_KEY");
  if (!gatewayApiKey) {
    throw new Error("VERCEL_AI_GATEWAY_API_KEY not configured");
  }

  const startTime = Date.now();

  // Build request body
  const requestBody: Record<string, unknown> = {
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    stream: true,
  };

  // Add reasoning/thinking based on mode
  // Note: When reasoning/thinking is enabled, temperature must be omitted
  if (thinkingMode === "adaptive") {
    // Claude 4.6+ adaptive thinking
    requestBody.reasoning = { type: "adaptive" };
  } else if (reasoningEnabled && reasoningBudget && reasoningBudget > 0) {
    // Legacy budget-based thinking
    requestBody.reasoning = {
      enabled: true,
      budget_tokens: reasoningBudget,
    };
  } else {
    requestBody.temperature = temperature;
  }

  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  // Transform the stream
  const encoder = new TextEncoder();
  let fullContent = "";
  let fullReasoning = "";

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            // Send reasoning as a separate event before DONE if we captured any
            if (fullReasoning) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reasoning: fullReasoning })}\n\n`));
            }
            // Log the call when done
            const durationMs = Date.now() - startTime;
            await logAICall({
              sessionId,
              promptSlug,
              modelId,
              fullPrompt: `${systemPrompt}\n\n${userMessage}`,
              fullResponse: fullContent,
              durationMs,
            });
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          } else {
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              // Handle content delta
              const content = delta?.content || "";
              if (content) {
                fullContent += content;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }

              // Handle reasoning delta (if streaming reasoning is supported)
              const reasoning = delta?.reasoning || "";
              if (reasoning) {
                fullReasoning += reasoning;
                // Optionally stream reasoning updates (commented out to avoid noise)
                // controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reasoning_delta: reasoning })}\n\n`));
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }
      }
    },
  });

  const body = response.body?.pipeThrough(transformStream);

  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Call image model (DALL-E, Imagen, FLUX)
 */
/**
 * Call image model via Vercel AI SDK's generateImage().
 *
 * Unified handler for ALL image providers (BFL, Google, OpenAI).
 * The SDK handles provider-specific translation, polling (BFL), and
 * reference image delivery (prompt.images) automatically.
 *
 * See: docs/vercel-docs/ai-sdk-image-generation.md
 */
async function callImageModelSDK(params: {
  modelId: string;
  prompt: string;
  systemPrompt: string;
  imageConfig: ImageConfig;
  aspectRatio: string | null;
  referenceImage?: string;
}): Promise<AICallResult> {
  const { modelId, prompt, systemPrompt, imageConfig, aspectRatio, referenceImage } = params;

  const gatewayApiKey = Deno.env.get("VERCEL_AI_GATEWAY_API_KEY");
  if (!gatewayApiKey) {
    throw new Error("VERCEL_AI_GATEWAY_API_KEY not configured");
  }

  // Combine system instructions (from Prompt Studio template) with user prompt.
  // systemPrompt = DB template with system instructions only (no user content).
  // prompt = user's actual image generation request (from userMessage/content).
  const trimmedSystem = systemPrompt?.trim();
  const fullPrompt = trimmedSystem && trimmedSystem !== "{{content}}"
    ? `${trimmedSystem}\n\n${prompt}`
    : prompt;

  const effectiveAspectRatio = aspectRatio || imageConfig.default_aspect_ratio || "1:1";

  // Build the prompt — string for text-to-image, object for image-to-image
  let sdkPrompt: string | { text: string; images: string[] };
  if (referenceImage && imageConfig.supports_image_input) {
    sdkPrompt = {
      text: fullPrompt,
      images: [referenceImage], // raw base64 — SDK handles encoding per provider
    };
    console.log(`[generate] Reference image attached via prompt.images (${Math.round(referenceImage.length * 3 / 4 / 1024)}KB)`);
  } else {
    sdkPrompt = fullPrompt;
  }

  // Build provider-specific options
  const providerOptions: Record<string, Record<string, unknown>> = {};

  // Choose model instance: Google Gemini uses direct provider (first-class image editing),
  // everything else goes through the Vercel AI Gateway.
  let modelInstance;

  if (imageConfig.provider_options_key === "google") {
    // Direct Google provider — Gemini image models are multimodal LLMs, not native
    // gateway image models. The direct provider handles prompt.images correctly.
    const googleApiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!googleApiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");
    }
    const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
    // Gateway ID: "google/gemini-3-pro-image" → Direct provider ID: "gemini-3-pro-image-preview"
    const googleModelId = modelId.replace("google/", "") + "-preview";
    modelInstance = google.image(googleModelId);
    console.log(`[generate] Using direct Google provider: ${googleModelId}`);
  } else {
    // Gateway for BFL, OpenAI, etc. — native image models
    const gateway = createGateway({ apiKey: gatewayApiKey });
    modelInstance = gateway.image(modelId);
    console.log(`[generate] Using AI Gateway: ${modelId}`);
  }

  switch (imageConfig.provider_options_key) {
    case "bfl": {
      const dims = aspectRatioToBflDimensions(effectiveAspectRatio, imageConfig, modelId);
      providerOptions.blackForestLabs = {
        width: dims.width,
        height: dims.height,
      };
      console.log(`[generate] BFL dimensions for ${modelId}: ${dims.width}x${dims.height} (${(dims.width * dims.height / 1_000_000).toFixed(2)}MP)`);
      break;
    }
    case "openai": {
      if (imageConfig.quality_options?.includes("hd")) {
        providerOptions.openai = { quality: "hd" };
      }
      break;
    }
    // Google: no special providerOptions needed — aspectRatio param handles it
  }

  console.log(`[generate] AI SDK generateImage: model=${modelId}, aspectRatio=${effectiveAspectRatio}, hasRef=${!!referenceImage}, provider=${imageConfig.provider_options_key}`);

  const result = await generateImage({
    model: modelInstance,
    prompt: sdkPrompt,
    aspectRatio: effectiveAspectRatio,
    providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
  });

  if (!result.image) {
    throw new Error("No image returned from AI SDK generateImage()");
  }

  console.log(`[generate] AI SDK image received: mediaType=${result.image.mediaType}, base64Length=${result.image.base64.length}`);

  return {
    image: {
      base64: result.image.base64,
      media_type: result.image.mediaType || "image/png",
    },
  };
}

/**
 * Call research model (Perplexity)
 */
async function callResearchModel(params: {
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
}): Promise<AICallResult> {
  const { modelId, systemPrompt, userMessage, temperature, maxTokens } = params;

  const gatewayApiKey = Deno.env.get("VERCEL_AI_GATEWAY_API_KEY");
  if (!gatewayApiKey) {
    throw new Error("VERCEL_AI_GATEWAY_API_KEY not configured");
  }

  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayApiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Research API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}

// ============================================================================
// Image Dimension Helpers
// ============================================================================

/**
 * Compute optimal BFL dimensions for a given aspect ratio and model.
 *
 * BFL constraints:
 * - Dimensions must be multiples of 16
 * - FLUX 2 Pro / FLUX 1.1 Pro Ultra: max ~4 megapixels
 * - FLUX Kontext Pro: max ~1 megapixel
 * - FLUX Kontext Max: max ~1 megapixel
 *
 * Falls back to supported_dimensions from DB config if available.
 */
function aspectRatioToBflDimensions(
  aspectRatio: string,
  config: ImageConfig,
  modelId: string
): { width: number; height: number } {
  // Parse aspect ratio
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) {
    return config.default_dimensions || { width: 1024, height: 1024 };
  }

  // Determine max megapixels based on model
  const isKontext = modelId.includes("kontext");
  const maxPixels = isKontext ? 1_048_576 : 4_194_304; // 1MP vs 4MP

  // Calculate optimal dimensions at max resolution
  const ratio = w / h;
  // height = sqrt(maxPixels / ratio), then round down to nearest multiple of 16
  const rawHeight = Math.sqrt(maxPixels / ratio);
  const height = Math.floor(rawHeight / 16) * 16;
  const width = Math.floor((height * ratio) / 16) * 16;

  // Sanity check — don't exceed maxPixels
  if (width * height > maxPixels) {
    // Scale down one step
    const scaledHeight = height - 16;
    const scaledWidth = Math.floor((scaledHeight * ratio) / 16) * 16;
    return { width: scaledWidth, height: scaledHeight };
  }

  return { width, height };
}

// ============================================================================
// Logging
// ============================================================================

async function logAICall(params: {
  sessionId?: string;
  promptSlug: string;
  modelId: string;
  fullPrompt: string;
  fullResponse: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs: number;
  errorMessage?: string;
}) {
  try {
    const supabase = getSupabaseAdmin();

    await supabase.from("ai_call_logs").insert({
      session_id: params.sessionId || null,
      prompt_set_slug: params.promptSlug,
      full_prompt: params.fullPrompt,
      full_response: params.fullResponse,
      model_id: params.modelId,
      tokens_in: params.tokensIn || null,
      tokens_out: params.tokensOut || null,
      duration_ms: params.durationMs,
      error_message: params.errorMessage || null,
    });
  } catch (error) {
    console.warn("Failed to log AI call:", error);
  }
}
