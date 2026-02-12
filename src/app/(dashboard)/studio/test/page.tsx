"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FlaskConical,
  Play,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Clock,
  Zap,
  Hash,
  FileText,
  MessageSquare,
  Image,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGenerate } from "@/hooks/use-generate";
import ReactMarkdown from "react-markdown";

interface PromptSet {
  id: string;
  slug: string;
  name: string;
  prompt_type: string;
}

interface PromptVersion {
  id: string;
  prompt_content: string;
  model_id: string | null;
  api_config: { temperature?: number; max_tokens?: number };
}

interface AIModel {
  id: string;
  model_id: string;
  display_name: string;
  model_type: string;
}

interface Destination {
  id: string;
  slug: string;
  name: string;
  prompt_instructions: string | null;
}

interface BrandGuideline {
  id: string;
  category: string;
  name: string;
  content: string;
  is_active: boolean;
}

export default function TestPage() {
  const searchParams = useSearchParams();
  const initialPromptSlug = searchParams.get("prompt");

  // Data state
  const [prompts, setPrompts] = useState<PromptSet[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [guidelines, setGuidelines] = useState<BrandGuideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedPromptSlug, setSelectedPromptSlug] = useState(initialPromptSlug || "");
  const [selectedPrompt, setSelectedPrompt] = useState<PromptSet | null>(null);
  const [promptVersion, setPromptVersion] = useState<PromptVersion | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedDestination, setSelectedDestination] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Preview state
  const [assembledPrompt, setAssembledPrompt] = useState("");
  const [tokenEstimate, setTokenEstimate] = useState(0);

  // Execution state
  const { generate, isLoading: isExecuting, result, error: executeError, streamedContent, reset } = useGenerate();
  const [executionMeta, setExecutionMeta] = useState<{
    model_used: string;
    tokens_in: number;
    tokens_out: number;
    duration_ms: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  // Load all data on mount
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [promptsRes, modelsRes, destinationsRes, guidelinesRes] = await Promise.all([
        supabase.from("prompt_sets").select("id, slug, name, prompt_type").order("name"),
        supabase.from("ai_models").select("id, model_id, display_name, model_type").eq("is_available", true).order("display_name"),
        supabase.from("destinations").select("id, slug, name, prompt_instructions").eq("is_active", true).order("name"),
        supabase.from("brand_guidelines").select("*").eq("is_active", true).order("category"),
      ]);

      if (promptsRes.error) throw promptsRes.error;
      if (modelsRes.error) throw modelsRes.error;
      if (destinationsRes.error) throw destinationsRes.error;
      if (guidelinesRes.error) throw guidelinesRes.error;

      setPrompts(promptsRes.data || []);
      setModels(modelsRes.data || []);
      setDestinations(destinationsRes.data || []);
      setGuidelines(guidelinesRes.data || []);

      // If initial prompt was specified, select it
      if (initialPromptSlug) {
        const found = promptsRes.data?.find((p) => p.slug === initialPromptSlug);
        if (found) {
          setSelectedPrompt(found);
          await loadPromptVersion(found.id);
        }
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, initialPromptSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load prompt version when prompt changes
  const loadPromptVersion = async (promptSetId: string) => {
    try {
      // Get the prompt set first to find current_version_id
      const { data: promptSet } = await supabase
        .from("prompt_sets")
        .select("current_version_id")
        .eq("id", promptSetId)
        .single();

      if (promptSet?.current_version_id) {
        const { data: version } = await supabase
          .from("prompt_versions")
          .select("*")
          .eq("id", promptSet.current_version_id)
          .single();

        if (version) {
          setPromptVersion(version);
          setSelectedModelId(version.model_id || "");
        }
      }
    } catch (err) {
      console.error("Failed to load prompt version:", err);
    }
  };

  // Handle prompt selection
  const handlePromptChange = async (slug: string) => {
    setSelectedPromptSlug(slug);
    const prompt = prompts.find((p) => p.slug === slug);
    setSelectedPrompt(prompt || null);
    setVariables({});
    reset();
    setExecutionMeta(null);

    if (prompt) {
      await loadPromptVersion(prompt.id);
    } else {
      setPromptVersion(null);
    }
  };

  // Extract variables from prompt content
  const extractedVariables = useMemo(() => {
    if (!promptVersion?.prompt_content) return [];
    const matches = promptVersion.prompt_content.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.slice(2, -2)))];
  }, [promptVersion?.prompt_content]);

  // Assemble the prompt preview
  useEffect(() => {
    if (!promptVersion?.prompt_content) {
      setAssembledPrompt("");
      setTokenEstimate(0);
      return;
    }

    let assembled = promptVersion.prompt_content;

    // Interpolate variables
    for (const [key, value] of Object.entries(variables)) {
      assembled = assembled.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        value || `[${key}]`
      );
    }

    // Add destination instructions if selected
    if (selectedDestination) {
      const dest = destinations.find((d) => d.slug === selectedDestination);
      if (dest?.prompt_instructions) {
        assembled = assembled.replace(
          "{{destination_requirements}}",
          dest.prompt_instructions
        );
      }
    }

    // Add guideline placeholders
    const guidelinesByCategory = guidelines.reduce((acc, g) => {
      if (!acc[g.category]) acc[g.category] = [];
      acc[g.category].push(g.content);
      return acc;
    }, {} as Record<string, string[]>);

    for (const [category, contents] of Object.entries(guidelinesByCategory)) {
      assembled = assembled.replace(
        new RegExp(`\\{\\{${category}_guidelines\\}\\}`, "g"),
        contents.join("\n\n")
      );
    }

    setAssembledPrompt(assembled);

    // Rough token estimate (4 chars per token)
    setTokenEstimate(Math.ceil(assembled.length / 4));
  }, [promptVersion?.prompt_content, variables, selectedDestination, destinations, guidelines]);

  // Execute the test
  const handleExecute = async () => {
    if (!selectedPromptSlug) return;

    reset();
    setExecutionMeta(null);

    const result = await generate({
      prompt_slug: selectedPromptSlug,
      variables,
      overrides: {
        model_id: selectedModelId || undefined,
        destination_slug: selectedDestination || undefined,
      },
    });

    if (result?.meta) {
      setExecutionMeta({
        model_used: result.meta.model_used || "Unknown",
        tokens_in: result.meta.tokens_in || 0,
        tokens_out: result.meta.tokens_out || 0,
        duration_ms: result.meta.duration_ms || 0,
      });
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(assembledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <MessageSquare className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      case "research":
        return <Search className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedPromptSlug} onValueChange={handlePromptChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {prompts.map((prompt) => (
                      <SelectItem key={prompt.slug} value={prompt.slug}>
                        {prompt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Model Override</Label>
                  <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Use default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Use template default</SelectItem>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            {getModelTypeIcon(model.model_type)}
                            <span>{model.display_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Select value={selectedDestination} onValueChange={setSelectedDestination}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No destination</SelectItem>
                      {destinations.map((dest) => (
                        <SelectItem key={dest.slug} value={dest.slug}>
                          {dest.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {extractedVariables.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label>Variables</Label>
                    {extractedVariables.map((varName) => (
                      <div key={varName} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{varName}</Label>
                        {varName.includes("content") || varName.includes("description") ? (
                          <Textarea
                            value={variables[varName] || ""}
                            onChange={(e) =>
                              setVariables({ ...variables, [varName]: e.target.value })
                            }
                            placeholder={`Enter ${varName}...`}
                            className="min-h-[80px]"
                          />
                        ) : (
                          <Input
                            value={variables[varName] || ""}
                            onChange={(e) =>
                              setVariables({ ...variables, [varName]: e.target.value })
                            }
                            placeholder={`Enter ${varName}...`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  ~{tokenEstimate.toLocaleString()} tokens
                </div>
                <Button onClick={handleExecute} disabled={!selectedPromptSlug || isExecuting}>
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Test
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Assembled Prompt</CardTitle>
                <Button variant="ghost" size="sm" onClick={copyPrompt}>
                  {copied ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                Preview of the prompt that will be sent to the AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {assembledPrompt ? (
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded-lg">
                    {assembledPrompt}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Select a template to preview
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Response Panel */}
      {(result || streamedContent || executeError) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Response</CardTitle>
              {executionMeta && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {executionMeta.model_used}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {executionMeta.tokens_in} in / {executionMeta.tokens_out} out
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(executionMeta.duration_ms / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {executeError && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{executeError.message}</p>
              </div>
            )}
            {(result?.content || streamedContent) && (
              <ScrollArea className="h-[400px]">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>
                    {result?.content || streamedContent || ""}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            )}
            {result?.image && (
              <div className="flex justify-center">
                <img
                  src={`data:${result.image.media_type};base64,${result.image.base64}`}
                  alt="Generated image"
                  className="max-w-full rounded-lg"
                />
              </div>
            )}
            {result?.citations && result.citations.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Label className="text-sm">Citations</Label>
                <div className="mt-2 space-y-1">
                  {result.citations.map((citation, i) => (
                    <a
                      key={i}
                      href={citation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-primary hover:underline truncate"
                    >
                      {citation}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
