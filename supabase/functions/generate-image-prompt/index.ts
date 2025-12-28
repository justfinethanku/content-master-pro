/**
 * Generate Image Prompt Edge Function
 *
 * Creates optimized image prompts for Gemini/DALL-E/Midjourney.
 * Uses database-driven brand guidelines for visual consistency.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSupabaseClient, getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabase.ts";
import { loadActivePromptConfig, buildPrompt } from "../_shared/prompts.ts";
import { callAI, parseJSONResponse } from "../_shared/ai.ts";
import { buildGuidelineVariables, seedDefaultGuidelines } from "../_shared/guidelines.ts";

interface ImagePromptRequest {
  title: string;
  description?: string;
  draft_excerpt?: string;
  image_type: "substack_header" | "youtube_thumbnail" | "social_share" | "infographic";
  style_preference?: string;
  session_id?: string;
  guideline_overrides?: Record<string, boolean>;
}

interface ImagePrompt {
  prompt: string;
  negative_prompt?: string;
  style_notes: string;
  aspect_ratio: string;
  suggested_model: string;
  alt_text: string;
}

interface ImagePromptResult {
  prompts: ImagePrompt[];
  brand_elements: string[];
  color_palette: string[];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get authenticated user
    const authHeader = req.headers.get("authorization");
    const supabase = getSupabaseClient(authHeader ?? undefined);
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    // Parse request body
    const {
      title,
      description,
      draft_excerpt,
      image_type,
      style_preference,
      session_id,
      guideline_overrides,
    } = (await req.json()) as ImagePromptRequest;

    if (!title || title.trim().length === 0) {
      return errorResponse("Title is required", 400);
    }

    // Load prompt configuration
    const promptConfig = await loadActivePromptConfig("image_prompt_generator");

    // Seed default guidelines for user if they don't have any
    await seedDefaultGuidelines(user.id);

    // Load brand guidelines from database
    const guidelineVars = await buildGuidelineVariables(
      promptConfig.promptSetId,
      user.id,
      guideline_overrides
    );
    const imageGuidelines = guidelineVars.image_guidelines || "";

    // Image type specifications
    const imageSpecs = {
      substack_header: {
        aspect_ratio: "1200:630",
        notes: "Substack header image - should work as email preview and web header",
        suggested_model: "google/gemini-3-pro-image",
      },
      youtube_thumbnail: {
        aspect_ratio: "16:9",
        notes: "YouTube thumbnail - needs to pop at small sizes, readable text space",
        suggested_model: "google/gemini-3-pro-image",
      },
      social_share: {
        aspect_ratio: "1:1",
        notes: "Social media share image - works on Twitter, LinkedIn, Instagram",
        suggested_model: "google/gemini-3-pro-image",
      },
      infographic: {
        aspect_ratio: "2:3",
        notes: "Vertical infographic - for Pinterest or carousel posts",
        suggested_model: "openai/dall-e-3",
      },
    };

    const spec = imageSpecs[image_type];

    // Build the system prompt
    const systemPrompt = buildPrompt(promptConfig, {});

    // Build user message with dynamic guidelines
    const brandStyleSection = imageGuidelines
      ? `BRAND STYLE GUIDELINES:\n${imageGuidelines}`
      : `BRAND STYLE (default):
- Cinematic realism with clean, modern aesthetics
- Conceptual/metaphorical imagery preferred over literal illustrations`;

    const userMessage = `
Title: ${title}
${description ? `Description: ${description}` : ""}
${draft_excerpt ? `Content Excerpt: ${draft_excerpt.substring(0, 500)}...` : ""}

Image Type: ${image_type}
Aspect Ratio: ${spec.aspect_ratio}
Notes: ${spec.notes}
${style_preference ? `Style Preference: ${style_preference}` : ""}

Create 3 distinct image prompts for this content. Follow these guidelines:

${brandStyleSection}

For each prompt:
1. Be specific about composition, lighting, and mood
2. Include style modifiers that work well with AI image generation
3. Avoid text in the image (will be added separately)
4. Consider what will draw attention at thumbnail size

Return a JSON object with this structure:
{
  "prompts": [
    {
      "prompt": "Detailed image generation prompt with style modifiers",
      "negative_prompt": "What to avoid in the image",
      "style_notes": "Brief explanation of the visual concept",
      "aspect_ratio": "${spec.aspect_ratio}",
      "suggested_model": "${spec.suggested_model}",
      "alt_text": "Accessibility description of what the image shows"
    }
  ],
  "brand_elements": ["element1", "element2"],
  "color_palette": ["#hex1", "#hex2", "#hex3"]
}

Return ONLY valid JSON, no markdown code blocks.
    `.trim();

    // Call AI
    const result = await callAI({
      promptConfig,
      systemPrompt,
      userPrompt: userMessage,
      sessionId: session_id,
    });

    // Parse the AI response as JSON
    const parsedResult = parseJSONResponse<ImagePromptResult>(result.content);

    // Save to database if session_id provided
    if (session_id) {
      const adminSupabase = getSupabaseAdmin();
      await adminSupabase.from("content_outputs").insert({
        session_id,
        output_type: "image_prompts",
        content: parsedResult,
      });
    }

    return jsonResponse({
      success: true,
      result: parsedResult,
      tokens: {
        input: result.tokensIn,
        output: result.tokensOut,
      },
    });
  } catch (error) {
    console.error("Generate image prompt error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to generate image prompts",
      500
    );
  }
});
