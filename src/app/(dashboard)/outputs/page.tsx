"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Video,
  Image,
  ArrowLeft,
  Copy,
  Download,
  RefreshCw,
  Clock,
  Hash,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGenerate, useGenerateJSON } from "@/hooks/use-generate";
import { GuidelineToggle, useGuidelineOverrides } from "@/components/guideline-toggle";

interface DraftData {
  title: string;
  content: string;
}

interface YouTubeSection {
  timestamp?: string;
  section_title?: string;
  script_content?: string;
  b_roll_suggestions?: string[];
  on_screen_text?: string;
}

interface YouTubeScript {
  title?: string;
  hook?: string;
  thumbnail_concepts?: string[];
  sections?: YouTubeSection[];
  outro?: string;
  call_to_action?: string;
  description?: string;
  tags?: string[];
  estimated_duration?: string;
}

interface TikTokScript {
  hook?: string;
  script?: string;
  on_screen_text?: string[];
  audio_suggestion?: string;
  hashtags?: string[];
  estimated_seconds?: number;
  style?: string;
}

interface TikTokResult {
  topic?: string;
  scripts?: TikTokScript[];
  caption?: string;
  best_posting_times?: string[];
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
  prompts?: ImagePrompt[];
  brand_elements?: string[];
  color_palette?: string[];
}

interface GeneratedImage {
  image_base64?: string;
  image_url?: string;
  model_used: string;
  revised_prompt?: string;
}

export default function OutputsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [draftData, setDraftData] = useState<DraftData | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [activeTab, setActiveTab] = useState("youtube");

  // YouTube state
  const [youtubeScript, setYoutubeScript] = useState<YouTubeScript | null>(null);

  // TikTok state
  const [tiktokResult, setTiktokResult] = useState<TikTokResult | null>(null);

  // Image prompts state
  const [imagePrompts, setImagePrompts] = useState<ImagePromptResult | null>(null);
  const [imageType, setImageType] = useState<"substack_header" | "youtube_thumbnail" | "social_share">("substack_header");

  // Generated images state (indexed by prompt index)
  const [generatedImages, setGeneratedImages] = useState<Record<number, GeneratedImage>>({});
  const [generatingImageIndex, setGeneratingImageIndex] = useState<number | null>(null);

  // Guideline overrides for image generation
  const { overrides: guidelineOverrides, handleChange: handleGuidelineChange } = useGuidelineOverrides();

  // Local error for loading
  const [loadError, setLoadError] = useState<string | null>(null);

  // Use the universal generate hooks
  const { generateJSON: generateYoutubeJSON, isLoading: isGeneratingYoutube, error: youtubeError } = useGenerateJSON<YouTubeScript>();
  const { generateJSON: generateTiktokJSON, isLoading: isGeneratingTiktok, error: tiktokError } = useGenerateJSON<TikTokResult>();
  const { generateJSON: generateImagePromptsJSON, isLoading: isGeneratingImages, error: imagePromptsError } = useGenerateJSON<ImagePromptResult>();
  const { generate: generateImageRaw, isLoading: isGeneratingImage, error: imageError } = useGenerate();

  const error = loadError || youtubeError?.message || tiktokError?.message || imagePromptsError?.message || imageError?.message || null;

  // Load draft from database using session_id
  useEffect(() => {
    async function loadDraft() {
      if (!sessionId) {
        setIsLoadingDraft(false);
        return;
      }

      try {
        const supabase = createClient();

        // Fetch draft for this session
        const { data: draftRecord, error: draftError } = await supabase
          .from("content_drafts")
          .select("content")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (draftError) {
          console.error("Failed to load draft:", draftError);
          setLoadError("Failed to load draft data");
          setIsLoadingDraft(false);
          return;
        }

        // Also fetch the session title from outline
        const { data: outlineData } = await supabase
          .from("content_outlines")
          .select("outline_json")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Get title from outline or session
        let title = "Untitled Draft";
        if (outlineData?.outline_json?.title) {
          title = outlineData.outline_json.title;
        } else {
          // Fallback to session title
          const { data: sessionData } = await supabase
            .from("content_sessions")
            .select("title")
            .eq("id", sessionId)
            .single();
          if (sessionData?.title) {
            title = sessionData.title;
          }
        }

        if (draftRecord) {
          setDraftData({
            title,
            content: draftRecord.content,
          });

          // Update session status to 'outputs'
          await supabase
            .from("content_sessions")
            .update({ status: "outputs" })
            .eq("id", sessionId);

          // Load existing outputs for this session
          const { data: existingOutputs } = await supabase
            .from("content_outputs")
            .select("output_type, content, metadata")
            .eq("session_id", sessionId);

          if (existingOutputs) {
            for (const output of existingOutputs) {
              try {
                const parsed = JSON.parse(output.content);
                switch (output.output_type) {
                  case "youtube_script":
                    setYoutubeScript(parsed);
                    break;
                  case "tiktok_30s":
                    setTiktokResult(parsed);
                    break;
                  case "image_prompts":
                    setImagePrompts(parsed);
                    // Restore image type from metadata if available
                    const meta = output.metadata as { image_type?: string } | null;
                    if (meta?.image_type && ["substack_header", "youtube_thumbnail", "social_share"].includes(meta.image_type)) {
                      setImageType(meta.image_type as typeof imageType);
                    }
                    break;
                }
              } catch (e) {
                console.error(`Failed to parse ${output.output_type}:`, e);
              }
            }
          }

          // Load generated images for this session
          const { data: savedImages } = await supabase
            .from("generated_images")
            .select("public_url, model_used, prompt")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });

          if (savedImages && savedImages.length > 0) {
            // Map images to their prompt index based on order
            const imageMap: Record<number, GeneratedImage> = {};
            savedImages.forEach((img, index) => {
              imageMap[index] = {
                image_url: img.public_url,
                model_used: img.model_used,
              };
            });
            setGeneratedImages(imageMap);
          }
        }
      } catch (err) {
        console.error("Error loading draft:", err);
        setLoadError("Failed to load draft data");
      } finally {
        setIsLoadingDraft(false);
      }
    }

    loadDraft();
  }, [sessionId]);

  const generateYoutubeScript = useCallback(async () => {
    if (!draftData) return;

    // Use the universal generate endpoint with YouTube destination
    // Most variables are auto-resolved from database using session_id
    const result = await generateYoutubeJSON({
      prompt_slug: "youtube_script_writer",
      session_id: sessionId || undefined,
      variables: {
        // Runtime config parameter
        target_length: "medium",
      },
      overrides: {
        destination_slug: "youtube",
      },
    });

    if (result) {
      setYoutubeScript(result);

      // Save to database
      if (sessionId) {
        const supabase = createClient();

        // Check if output exists for this session and type
        const { data: existingOutput } = await supabase
          .from("content_outputs")
          .select("id")
          .eq("session_id", sessionId)
          .eq("output_type", "youtube_script")
          .single();

        let saveError;
        if (existingOutput) {
          const { error } = await supabase
            .from("content_outputs")
            .update({
              content: JSON.stringify(result),
              metadata: {
                title: result.title || "",
                estimated_duration: result.estimated_duration || "",
                tags: result.tags || [],
              },
            })
            .eq("session_id", sessionId)
            .eq("output_type", "youtube_script");
          saveError = error;
        } else {
          const { error } = await supabase
            .from("content_outputs")
            .insert({
              session_id: sessionId,
              output_type: "youtube_script",
              content: JSON.stringify(result),
              metadata: {
                title: result.title || "",
                estimated_duration: result.estimated_duration || "",
                tags: result.tags || [],
              },
            });
          saveError = error;
        }

        if (saveError) {
          console.error("Failed to save YouTube script:", saveError);
        }
      }
    }
  }, [draftData, sessionId, generateYoutubeJSON]);

  const generateTiktokScripts = useCallback(async () => {
    if (!draftData) return;

    // Use the universal generate endpoint with TikTok destination
    // Most variables are auto-resolved from database using session_id
    const result = await generateTiktokJSON({
      prompt_slug: "tiktok_script_writer",
      session_id: sessionId || undefined,
      variables: {
        // Runtime config parameter
        num_scripts: "3",
      },
      overrides: {
        destination_slug: "tiktok",
      },
    });

    if (result) {
      setTiktokResult(result);

      // Save to database (save as tiktok_30s, contains all script variations)
      if (sessionId) {
        const supabase = createClient();

        // Check if output exists for this session and type
        const { data: existingOutput } = await supabase
          .from("content_outputs")
          .select("id")
          .eq("session_id", sessionId)
          .eq("output_type", "tiktok_30s")
          .single();

        let saveError;
        if (existingOutput) {
          const { error } = await supabase
            .from("content_outputs")
            .update({
              content: JSON.stringify(result),
              metadata: {
                topic: result.topic || "",
                script_count: result.scripts?.length ?? 0,
                best_posting_times: result.best_posting_times || [],
              },
            })
            .eq("session_id", sessionId)
            .eq("output_type", "tiktok_30s");
          saveError = error;
        } else {
          const { error } = await supabase
            .from("content_outputs")
            .insert({
              session_id: sessionId,
              output_type: "tiktok_30s",
              content: JSON.stringify(result),
              metadata: {
                topic: result.topic || "",
                script_count: result.scripts?.length ?? 0,
                best_posting_times: result.best_posting_times || [],
              },
            });
          saveError = error;
        }

        if (saveError) {
          console.error("Failed to save TikTok scripts:", saveError);
        }
      }
    }
  }, [draftData, sessionId, generateTiktokJSON]);

  const generateImagePrompts = useCallback(async () => {
    if (!draftData) return;

    // Use the universal generate endpoint
    // Most variables are auto-resolved from database using session_id
    const result = await generateImagePromptsJSON({
      prompt_slug: "image_prompt_generator",
      session_id: sessionId || undefined,
      variables: {
        // Runtime config parameter
        image_type: imageType,
      },
      overrides: {
        guideline_overrides: Object.keys(guidelineOverrides).length > 0 ? guidelineOverrides : undefined,
      },
    });

    if (result) {
      setImagePrompts(result);

      // Save to database
      if (sessionId) {
        const supabase = createClient();

        // Check if output exists for this session and type
        const { data: existingOutput } = await supabase
          .from("content_outputs")
          .select("id")
          .eq("session_id", sessionId)
          .eq("output_type", "image_prompts")
          .single();

        let saveError;
        if (existingOutput) {
          const { error } = await supabase
            .from("content_outputs")
            .update({
              content: JSON.stringify(result),
              metadata: {
                image_type: imageType,
                prompt_count: result.prompts?.length ?? 0,
                brand_elements: result.brand_elements || [],
                color_palette: result.color_palette || [],
              },
            })
            .eq("session_id", sessionId)
            .eq("output_type", "image_prompts");
          saveError = error;
        } else {
          const { error } = await supabase
            .from("content_outputs")
            .insert({
              session_id: sessionId,
              output_type: "image_prompts",
              content: JSON.stringify(result),
              metadata: {
                image_type: imageType,
                prompt_count: result.prompts?.length ?? 0,
                brand_elements: result.brand_elements || [],
                color_palette: result.color_palette || [],
              },
            });
          saveError = error;
        }

        if (saveError) {
          console.error("Failed to save image prompts:", saveError);
        }
      }
    }
  }, [draftData, imageType, guidelineOverrides, sessionId, generateImagePromptsJSON]);

  const generateImage = useCallback(async (promptIndex: number, prompt: ImagePrompt) => {
    setGeneratingImageIndex(promptIndex);

    // Use the universal generate endpoint for image generation
    const result = await generateImageRaw({
      prompt_slug: "image_generator",
      session_id: sessionId || undefined,
      variables: {
        content: prompt.prompt,
        negative_prompt: prompt.negative_prompt || "",
        aspect_ratio: prompt.aspect_ratio,
      },
      overrides: {
        // Use the suggested model from the prompt or default to Imagen
        model_id: prompt.suggested_model.includes("flux")
          ? "bfl/flux-pro-1.1"
          : prompt.suggested_model.includes("dall")
          ? "openai/dall-e-3"
          : "google/imagen-4.0-generate",
      },
    });

    if (result?.success && result.image) {
      setGeneratedImages(prev => ({
        ...prev,
        [promptIndex]: {
          image_base64: result.image?.base64,
          image_url: result.image?.storage_url,
          model_used: result.meta.model_used,
        },
      }));
    }
    setGeneratingImageIndex(null);
  }, [sessionId, generateImageRaw]);

  const downloadImage = useCallback((imageBase64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${imageBase64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleBackToDraft = () => {
    const params = new URLSearchParams();
    if (sessionId) {
      params.set("session_id", sessionId);
    }
    router.push(`/draft?${params.toString()}`);
  };

  // Show loading while fetching draft from database
  if (isLoadingDraft) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outputs</h1>
          <p className="text-muted-foreground">
            Generate YouTube scripts, TikTok content, and image prompts.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-center">
              Loading draft data...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!draftData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outputs</h1>
          <p className="text-muted-foreground">
            Generate YouTube scripts, TikTok content, and image prompts.
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              {sessionId
                ? "No draft found for this session."
                : "No session found. Please start from the beginning."}
            </p>
            <Button onClick={handleBackToDraft}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {sessionId ? "Go to Draft" : "Start New Session"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outputs</h1>
          <p className="text-muted-foreground">
            {draftData.title}
          </p>
        </div>
        <Button variant="outline" onClick={handleBackToDraft}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Draft
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="youtube" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            YouTube
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            TikTok/Shorts
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Images
          </TabsTrigger>
        </TabsList>

        {/* YouTube Tab */}
        <TabsContent value="youtube" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>YouTube Script</CardTitle>
                <CardDescription>
                  Full video script with timestamps and B-roll suggestions
                </CardDescription>
              </div>
              <Button onClick={generateYoutubeScript} disabled={isGeneratingYoutube}>
                {isGeneratingYoutube ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : youtubeScript ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Script
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {youtubeScript ? (
                <div className="space-y-6">
                  {/* Title & Duration */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">{youtubeScript.title || "Untitled Script"}</h3>
                    {youtubeScript.estimated_duration && (
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        {youtubeScript.estimated_duration}
                      </Badge>
                    )}
                  </div>

                  {/* Thumbnail Concepts */}
                  {youtubeScript.thumbnail_concepts && youtubeScript.thumbnail_concepts.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Thumbnail Concepts</h4>
                      <div className="flex flex-wrap gap-2">
                        {youtubeScript.thumbnail_concepts.map((concept, i) => (
                          <Badge key={i} variant="outline">{concept}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Hook */}
                  {youtubeScript.hook && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Opening Hook</h4>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(youtubeScript.hook || "")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{youtubeScript.hook}</p>
                    </div>
                  )}

                  {/* Sections */}
                  {youtubeScript.sections && youtubeScript.sections.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-medium">Script Sections</h4>
                      {youtubeScript.sections.map((section, i) => (
                        <Card key={i} className="bg-muted/30">
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 mb-2">
                              {section.timestamp && (
                                <Badge variant="secondary">{section.timestamp}</Badge>
                              )}
                              <span className="font-medium">{section.section_title || `Section ${i + 1}`}</span>
                            </div>
                            {section.script_content && (
                              <p className="text-sm whitespace-pre-wrap mb-3">{section.script_content}</p>
                            )}
                            {section.b_roll_suggestions && section.b_roll_suggestions.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">B-Roll: </span>
                                {section.b_roll_suggestions.join(" | ")}
                              </div>
                            )}
                            {section.on_screen_text && (
                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">On-Screen: </span>
                                {section.on_screen_text}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Outro & CTA */}
                  {(youtubeScript.outro || youtubeScript.call_to_action) && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      {youtubeScript.outro && (
                        <>
                          <h4 className="font-medium mb-2">Outro</h4>
                          <p className="text-sm whitespace-pre-wrap mb-4">{youtubeScript.outro}</p>
                        </>
                      )}
                      {youtubeScript.call_to_action && (
                        <>
                          <h4 className="font-medium mb-2">Call to Action</h4>
                          <p className="text-sm">{youtubeScript.call_to_action}</p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Description & Tags */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {youtubeScript.description && (
                      <div>
                        <h4 className="font-medium mb-2">Video Description</h4>
                        <div className="relative">
                          <pre className="text-xs bg-muted rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {youtubeScript.description}
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-1 right-1"
                            onClick={() => copyToClipboard(youtubeScript.description || "")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {youtubeScript.tags && youtubeScript.tags.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-1">
                          {youtubeScript.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2"
                          onClick={() => copyToClipboard((youtubeScript.tags || []).join(", "))}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copy Tags
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Click "Generate Script" to create a YouTube video script from your draft.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TikTok Tab */}
        <TabsContent value="tiktok" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>TikTok / Shorts Scripts</CardTitle>
                <CardDescription>
                  Short-form video scripts optimized for vertical content
                </CardDescription>
              </div>
              <Button onClick={generateTiktokScripts} disabled={isGeneratingTiktok}>
                {isGeneratingTiktok ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : tiktokResult ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Scripts
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {tiktokResult ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Topic: {tiktokResult.topic || "Untitled"}</h3>
                    {tiktokResult.best_posting_times && tiktokResult.best_posting_times.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Best times: {tiktokResult.best_posting_times.join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                    {(tiktokResult.scripts || []).map((script, i) => (
                      <Card key={i}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">{script.style || "Script"}</Badge>
                            {script.estimated_seconds && (
                              <Badge variant="secondary">~{script.estimated_seconds}s</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {script.hook && (
                            <div className="bg-primary/10 rounded-lg p-3">
                              <p className="text-xs font-medium text-primary mb-1">Hook:</p>
                              <p className="text-sm font-medium">{script.hook}</p>
                            </div>
                          )}

                          {script.script && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Script:</p>
                              <p className="text-sm whitespace-pre-wrap">{script.script}</p>
                            </div>
                          )}

                          {script.on_screen_text && script.on_screen_text.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">On-Screen Text:</p>
                              <ul className="text-xs space-y-1">
                                {script.on_screen_text.map((text, j) => (
                                  <li key={j} className="bg-muted rounded px-2 py-1">{text}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {script.audio_suggestion && (
                            <div className="text-xs">
                              <span className="font-medium text-muted-foreground">Audio: </span>
                              {script.audio_suggestion}
                            </div>
                          )}

                          {script.hashtags && script.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {script.hashtags.map((tag, j) => (
                                <Badge key={j} variant="outline" className="text-xs">
                                  <Hash className="h-2 w-2 mr-0.5" />{tag}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => copyToClipboard(`${script.hook || ""}\n\n${script.script || ""}`)}
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copy Script
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {tiktokResult.caption && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Caption</h4>
                      <p className="text-sm whitespace-pre-wrap">{tiktokResult.caption}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => copyToClipboard(tiktokResult.caption || "")}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Caption
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Click "Generate Scripts" to create TikTok/Shorts scripts from your draft.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-4">
          {/* Guideline Toggle */}
          <GuidelineToggle
            categories={["image"]}
            onChange={handleGuidelineChange}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Image Prompts</CardTitle>
                <CardDescription>
                  AI image generation prompts for your content
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={imageType}
                  onChange={(e) => setImageType(e.target.value as typeof imageType)}
                  className="text-sm border rounded-md px-2 py-1 bg-background"
                >
                  <option value="substack_header">Substack Header</option>
                  <option value="youtube_thumbnail">YouTube Thumbnail</option>
                  <option value="social_share">Social Share</option>
                </select>
                <Button onClick={generateImagePrompts} disabled={isGeneratingImages}>
                  {isGeneratingImages ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : imagePrompts ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Prompts
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {imagePrompts ? (
                <div className="space-y-6">
                  {/* Brand Elements & Colors */}
                  {((imagePrompts.brand_elements && imagePrompts.brand_elements.length > 0) ||
                    (imagePrompts.color_palette && imagePrompts.color_palette.length > 0)) && (
                    <div className="flex flex-wrap gap-4">
                      {imagePrompts.brand_elements && imagePrompts.brand_elements.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Brand Elements</h4>
                          <div className="flex flex-wrap gap-1">
                            {imagePrompts.brand_elements.map((el, i) => (
                              <Badge key={i} variant="outline">{el}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {imagePrompts.color_palette && imagePrompts.color_palette.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Color Palette</h4>
                          <div className="flex gap-2">
                            {imagePrompts.color_palette.map((color, i) => (
                              <div
                                key={i}
                                className="w-8 h-8 rounded-md border"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Prompts */}
                  <div className="grid gap-4">
                    {(imagePrompts.prompts || []).map((prompt, i) => (
                      <Card key={i}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary">Option {i + 1}</Badge>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{prompt.aspect_ratio}</span>
                              <span>|</span>
                              <span>{prompt.suggested_model}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Prompt:</p>
                            <div className="relative">
                              <p className="text-sm bg-muted rounded-lg p-3 pr-10">
                                {prompt.prompt}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-1 right-1"
                                onClick={() => copyToClipboard(prompt.prompt)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {prompt.negative_prompt && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Negative Prompt:</p>
                              <p className="text-xs bg-destructive/10 rounded-lg p-2">
                                {prompt.negative_prompt}
                              </p>
                            </div>
                          )}

                          <div className="text-xs">
                            <span className="font-medium text-muted-foreground">Style Notes: </span>
                            {prompt.style_notes}
                          </div>

                          <div className="text-xs">
                            <span className="font-medium text-muted-foreground">Alt Text: </span>
                            {prompt.alt_text}
                          </div>

                          <Separator className="my-3" />

                          {/* Generate Image Button & Display */}
                          {generatedImages[i] ? (
                            <div className="space-y-3">
                              <div className="relative rounded-lg overflow-hidden border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={generatedImages[i].image_url || `data:image/png;base64,${generatedImages[i].image_base64}`}
                                  alt={prompt.alt_text}
                                  className="w-full h-auto"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  Generated with {generatedImages[i].model_used}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => generateImage(i, prompt)}
                                    disabled={generatingImageIndex !== null}
                                  >
                                    <RefreshCw className="mr-1 h-3 w-3" />
                                    Regenerate
                                  </Button>
                                  {generatedImages[i].image_base64 && (
                                    <Button
                                      size="sm"
                                      onClick={() => downloadImage(
                                        generatedImages[i].image_base64!,
                                        `${draftData?.title?.replace(/[^a-z0-9]/gi, "_") || "image"}_${i + 1}.png`
                                      )}
                                    >
                                      <Download className="mr-1 h-3 w-3" />
                                      Download
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Button
                              className="w-full"
                              onClick={() => generateImage(i, prompt)}
                              disabled={generatingImageIndex !== null}
                            >
                              {generatingImageIndex === i ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Generating Image...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-2 h-4 w-4" />
                                  Generate Image
                                </>
                              )}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Select an image type and click "Generate Prompts" to create AI image prompts.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
