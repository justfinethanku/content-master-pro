"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PromptSet {
  id: string;
  slug: string;
  name: string;
  prompt_type: string;
  description: string | null;
  current_version_id: string | null;
  pipeline_stage: string | null;
}

interface PromptVersion {
  id: string;
  version: number;
  model_id: string | null;
}

interface AIModel {
  id: string;
  display_name: string;
}

interface PromptWithVersion extends PromptSet {
  current_version?: PromptVersion;
}

export default function PromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptWithVersion[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load prompt sets
      const { data: promptSets, error: promptsError } = await supabase
        .from("prompt_sets")
        .select("*");

      if (promptsError) throw promptsError;

      // Load current versions for each prompt
      const promptsWithVersions: PromptWithVersion[] = [];
      for (const ps of promptSets || []) {
        if (ps.current_version_id) {
          const { data: version } = await supabase
            .from("prompt_versions")
            .select("id, version, model_id")
            .eq("id", ps.current_version_id)
            .single();

          promptsWithVersions.push({ ...ps, current_version: version || undefined });
        } else {
          promptsWithVersions.push(ps);
        }
      }

      // Sort by pipeline stage order
      const stageOrder: Record<string, number> = {
        create: 1,
        research: 2,
        outline: 3,
        draft: 4,
        voice: 5,
        outputs: 6,
        utility: 7,
      };

      const sortedPrompts = promptsWithVersions.sort((a, b) => {
        const orderA = a.pipeline_stage ? stageOrder[a.pipeline_stage] || 99 : 99;
        const orderB = b.pipeline_stage ? stageOrder[b.pipeline_stage] || 99 : 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      setPrompts(sortedPrompts);

      // Load AI models
      const { data: aiModels } = await supabase
        .from("ai_models")
        .select("id, display_name")
        .eq("is_available", true);

      setModels(aiModels || []);
    } catch (err) {
      console.error("Failed to load prompts:", err);
      setError(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const getStageColor = (stage: string | null): string => {
    switch (stage) {
      case "create": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      case "research": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "outline": return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200";
      case "draft": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "voice": return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
      case "outputs": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
      case "utility": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default: return "bg-muted text-muted-foreground";
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prompts</h1>
        <p className="text-muted-foreground">
          Manage AI prompts for the content pipeline. Click a prompt to edit.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {prompts.map((prompt) => (
          <Card
            key={prompt.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => router.push(`/studio/prompts/${prompt.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {prompt.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {prompt.description || prompt.slug}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {prompt.pipeline_stage && (
                    <Badge variant="secondary" className={getStageColor(prompt.pipeline_stage)}>
                      {prompt.pipeline_stage}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {prompt.prompt_type}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {prompt.current_version ? `v${prompt.current_version.version}` : "No version"}
                </span>
                <span>
                  {models.find((m) => m.id === prompt.current_version?.model_id)?.display_name || "No model"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
