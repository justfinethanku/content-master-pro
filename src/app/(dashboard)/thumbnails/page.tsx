"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PromptModelConfig {
  modelId: string;
  imageConfig: ImageModel["image_config"];
}
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ImageIcon,
  Loader2,
  AlertCircle,
  Download,
  Save,
  RefreshCw,
  Upload,
  X,
  Clock,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGenerate } from "@/hooks/use-generate";
import { useCreateAsset } from "@/hooks/use-assets";

// ============================================================================
// Types
// ============================================================================

interface ImageModel {
  model_id: string;
  display_name: string;
  provider: string;
  image_config: {
    provider_options_key: string;
    supported_aspect_ratios?: string[];
    default_aspect_ratio?: string;
    supports_image_input?: boolean;
  } | null;
}

interface ProjectOption {
  id: string;
  name: string;
  project_id: string;
}

// Friendly labels for aspect ratios
const ASPECT_RATIO_LABELS: Record<string, string> = {
  "16:9": "YouTube (16:9)",
  "2:1": "Substack (2:1)",
  "1:1": "Square (1:1)",
  "9:16": "Vertical (9:16)",
  "4:3": "Classic (4:3)",
  "3:4": "Portrait (3:4)",
  "3:2": "Photo (3:2)",
};

// Sentinel for "no project" in shadcn Select (doesn't support null values)
const NO_PROJECT = "__none__";

// Max reference image dimension (keeps base64 well under Supabase Edge Function limits)
const MAX_REF_IMAGE_DIMENSION = 2048;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resize an image file to fit within maxDimension, returning base64 (no prefix).
 * Uses canvas to compress as JPEG at 0.85 quality, keeping size manageable.
 */
function resizeImageToBase64(
  file: File,
  maxDimension: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if needed
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG for smaller size
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

// ============================================================================
// Page Component
// ============================================================================

export default function ThumbnailsPage() {
  const supabase = createClient();

  // Form state
  const [prompt, setPrompt] = useState("");
  const [titleText, setTitleText] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageName, setReferenceImageName] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { generate, isLoading, result, error } = useGenerate();
  const createAsset = useCreateAsset();

  // ============================================================================
  // Data Queries
  // ============================================================================

  // Load model from Prompt Studio's image_generator config (single source of truth)
  const { data: promptModelConfig } = useQuery({
    queryKey: ["prompt_config", "image_generator", "model"],
    queryFn: async (): Promise<PromptModelConfig | null> => {
      const { data, error } = await supabase
        .from("prompt_sets")
        .select(
          `prompt_versions!prompt_versions_prompt_set_id_fkey (
            ai_models!prompt_versions_model_id_fkey (
              model_id, display_name, provider, image_config
            )
          )`
        )
        .eq("slug", "image_generator")
        .eq("prompt_versions.status", "active")
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const version = (data?.prompt_versions as any)?.[0];
      const model = version?.ai_models?.[0] ?? version?.ai_models;
      if (error || !model?.model_id) return null;
      return {
        modelId: model.model_id as string,
        imageConfig: model.image_config as ImageModel["image_config"],
      };
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "list-simple"],
    queryFn: async (): Promise<ProjectOption[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_id")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as ProjectOption[];
    },
  });

  // ============================================================================
  // Derived State (model comes from Prompt Studio config)
  // ============================================================================

  const supportedAspectRatios = useMemo(() => {
    const ratios = promptModelConfig?.imageConfig?.supported_aspect_ratios;
    return ratios?.length ? ratios : ["16:9", "1:1", "9:16"];
  }, [promptModelConfig]);

  const supportsImageInput =
    promptModelConfig?.imageConfig?.supports_image_input ?? false;

  // ============================================================================
  // Handlers
  // ============================================================================


  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("Reference image must be under 20MB");
      return;
    }

    try {
      const base64 = await resizeImageToBase64(file, MAX_REF_IMAGE_DIMENSION);
      setReferenceImage(base64);
      setReferenceImageName(file.name);
    } catch {
      alert("Failed to process image. Please try a different file.");
    }
  }, []);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImageFile(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [processImageFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) processImageFile(file);
    },
    [processImageFile]
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    setSaveSuccess(false);

    // Assemble full prompt with title text
    let fullPrompt = prompt.trim();
    if (titleText.trim()) {
      fullPrompt += `\n\nInclude bold, legible text on the image reading: "${titleText.trim()}". The text should be high-contrast, prominent, and styled for a YouTube thumbnail.`;
    }

    await generate({
      prompt_slug: "image_generator",
      variables: { content: fullPrompt },
      overrides: {
        aspect_ratio: aspectRatio,
      },
      reference_image:
        referenceImage && supportsImageInput ? referenceImage : undefined,
    });
  }, [prompt, titleText, aspectRatio, referenceImage, supportsImageInput, generate]);

  const handleSaveToProject = useCallback(async () => {
    if (!selectedProjectId || !result?.image?.storage_url) return;

    try {
      await createAsset.mutateAsync({
        project_id: selectedProjectId,
        asset_id: `thumb_${Date.now()}`,
        name: titleText.trim() || `Thumbnail (${aspectRatio})`,
        asset_type: "thumbnail",
        file_url: result.image.storage_url,
        status: "draft",
        metadata: {
          prompt: prompt.trim(),
          title_text: titleText.trim() || null,
          model_used: result.meta.model_used,
          aspect_ratio: aspectRatio,
          reference_image_used: !!referenceImage,
          generated_at: new Date().toISOString(),
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save asset:", err);
    }
  }, [
    selectedProjectId,
    result,
    titleText,
    aspectRatio,
    prompt,
    referenceImage,
    createAsset,
  ]);

  const handleDownload = useCallback(() => {
    if (!result?.image?.base64) return;

    const mediaType = result.image.media_type || "image/png";
    const ext = mediaType === "image/jpeg" ? "jpg" : "png";
    const filename = titleText.trim()
      ? `${titleText.trim().replace(/\s+/g, "_").toLowerCase()}.${ext}`
      : `thumbnail_${Date.now()}.${ext}`;

    const link = document.createElement("a");
    link.href = `data:${mediaType};base64,${result.image.base64}`;
    link.download = filename;
    link.click();
  }, [result, titleText]);

  const handleRegenerate = useCallback(() => {
    setSaveSuccess(false);
    handleGenerate();
  }, [handleGenerate]);

  const handleProjectChange = useCallback((value: string) => {
    setSelectedProjectId(value === NO_PROJECT ? null : value);
  }, []);

  // ============================================================================
  // Derived flags for render
  // ============================================================================

  const hasProject = !!selectedProjectId;
  const canSave =
    hasProject &&
    !!result?.image?.storage_url &&
    !result.image.storage_failed;
  const storageFailed = result?.image?.storage_failed ?? false;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Thumbnails</h1>
        <p className="text-sm text-muted-foreground">
          Generate AI-powered thumbnails and cover images for your content
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left Column: Generation Form */}
        <div className="space-y-4">
          {/* Image Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Image prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the image you want to generate... (e.g., 'A futuristic cityscape at sunset with neon lights reflecting on wet streets, cinematic photography')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>

          {/* Title Text */}
          <div className="space-y-2">
            <Label htmlFor="title-text">
              Title text{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="title-text"
              placeholder='e.g., "SHOCKING TRUTH" or "HOW TO WIN"'
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Text to render on the thumbnail. Will be styled as bold,
              high-contrast headline text.
            </p>
          </div>

          {/* Reference Image */}
          <div className="space-y-2">
            <Label>
              Reference image{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`relative rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                      supportsImageInput
                        ? "border-border hover:border-primary/50 cursor-pointer"
                        : "border-border/50 opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() =>
                      supportsImageInput && fileInputRef.current?.click()
                    }
                    onDrop={supportsImageInput ? handleDrop : undefined}
                    onDragOver={
                      supportsImageInput
                        ? (e) => e.preventDefault()
                        : undefined
                    }
                  >
                    {referenceImage ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:image/jpeg;base64,${referenceImage}`}
                          alt="Reference"
                          className="h-16 w-16 rounded-md object-cover"
                        />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-foreground">
                            {referenceImageName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Click to replace or drag a new image
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReferenceImage(null);
                            setReferenceImageName("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 py-2">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {supportsImageInput
                            ? "Drop an image or click to upload"
                            : "Selected model doesn't support reference images"}
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </TooltipTrigger>
                {!supportsImageInput && (
                  <TooltipContent>
                    <p>
                      Selected model does not support reference images
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedAspectRatios.map((ratio: string) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ASPECT_RATIO_LABELS[ratio] || ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Selector */}
          <div className="space-y-2">
            <Label>
              Save to project{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Select
              value={selectedProjectId ?? NO_PROJECT}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Generate thumbnail
              </>
            )}
          </Button>
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-4">
          {/* Error */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Generation failed
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {error.message}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading Skeleton */}
          {isLoading && !result?.image && (
            <Card>
              <CardContent className="p-4">
                <div className="aspect-video animate-pulse rounded-lg bg-muted flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Generating your thumbnail...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This usually takes 10-30 seconds
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Image */}
          {result?.success && result.image && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Generated thumbnail
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {result.meta.model_used.split("/").pop()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {aspectRatio}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="mr-1 h-3 w-3" />
                      {(result.meta.duration_ms / 1000).toFixed(1)}s
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    result.image.storage_url ||
                    `data:${result.image.media_type};base64,${result.image.base64}`
                  }
                  alt="Generated thumbnail"
                  className="w-full rounded-lg"
                />

                {/* Storage failure warning */}
                {storageFailed && (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Image generated but could not be saved to storage. You
                      can still download it, but saving to a project is
                      unavailable.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isLoading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                  {hasProject && (
                    <Button
                      size="sm"
                      onClick={handleSaveToProject}
                      disabled={
                        createAsset.isPending || !canSave || saveSuccess
                      }
                    >
                      {saveSuccess ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Saved
                        </>
                      ) : createAsset.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save to project
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Save error */}
                {createAsset.isError && (
                  <p className="text-xs text-destructive">
                    Failed to save:{" "}
                    {createAsset.error?.message || "Unknown error"}
                  </p>
                )}

                {/* No project selected hint */}
                {!hasProject && !storageFailed && (
                  <p className="text-xs text-muted-foreground">
                    Select a project above to save this thumbnail as an asset
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isLoading && !result?.image && !error && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <CardTitle className="text-base text-muted-foreground">
                  No thumbnail yet
                </CardTitle>
                <CardDescription className="mt-1">
                  Enter a prompt and click Generate to create a thumbnail
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
