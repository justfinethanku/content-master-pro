"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  FileText,
  Edit,
  Save,
  Eye,
  History,
  RotateCcw,
  Loader2,
  Check,
  AlertCircle,
  Settings2,
  FlaskConical,
  Image,
  Search,
  MessageSquare,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import type { BrandGuideline } from "@/lib/supabase/guidelines";
import Link from "next/link";

interface PromptSet {
  id: string;
  slug: string;
  name: string;
  prompt_type: string;
  description: string | null;
  current_version_id: string | null;
}

interface PromptVersion {
  id: string;
  prompt_set_id: string;
  version: number;
  prompt_content: string;
  model_id: string | null;
  api_config: { temperature?: number; max_tokens?: number };
  status: "draft" | "active" | "archived";
  created_at: string;
}

interface AIModel {
  id: string;
  model_id: string;
  provider: string;
  display_name: string;
  model_type: string;
}

interface PromptWithVersion extends PromptSet {
  current_version?: PromptVersion;
  model?: AIModel;
}

export default function TemplatesPage() {
  const [prompts, setPrompts] = useState<PromptWithVersion[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editingPrompt, setEditingPrompt] = useState<PromptWithVersion | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorModelId, setEditorModelId] = useState<string>("");
  const [editorTemperature, setEditorTemperature] = useState(0.7);
  const [editorMaxTokens, setEditorMaxTokens] = useState(4096);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Version history
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  // Guidelines
  const [guidelines, setGuidelines] = useState<BrandGuideline[]>([]);
  const [guidelineDefaults, setGuidelineDefaults] = useState<Set<string>>(new Set());
  const [editorTab, setEditorTab] = useState<"prompt" | "guidelines">("prompt");

  const supabase = createClient();

  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load prompt sets
      const { data: promptSets, error: promptsError } = await supabase
        .from("prompt_sets")
        .select("*")
        .order("name");

      if (promptsError) throw promptsError;

      // Load AI models
      const { data: aiModels, error: modelsError } = await supabase
        .from("ai_models")
        .select("*")
        .eq("is_available", true)
        .order("display_name");

      if (modelsError) throw modelsError;
      setModels(aiModels || []);

      // Load current versions for each prompt
      const promptsWithVersions: PromptWithVersion[] = [];
      for (const ps of promptSets || []) {
        if (ps.current_version_id) {
          const { data: version } = await supabase
            .from("prompt_versions")
            .select("*")
            .eq("id", ps.current_version_id)
            .single();

          const model = aiModels?.find((m) => m.id === version?.model_id);
          promptsWithVersions.push({ ...ps, current_version: version || undefined, model });
        } else {
          promptsWithVersions.push(ps);
        }
      }

      setPrompts(promptsWithVersions);

      // Load brand guidelines
      const { data: guidelinesData } = await supabase
        .from("brand_guidelines")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("sort_order");

      setGuidelines(guidelinesData || []);
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

  const openEditor = async (prompt: PromptWithVersion) => {
    setEditingPrompt(prompt);
    setEditorContent(prompt.current_version?.prompt_content || "");
    setEditorModelId(prompt.current_version?.model_id || "");
    setEditorTemperature(prompt.current_version?.api_config?.temperature || 0.7);
    setEditorMaxTokens(prompt.current_version?.api_config?.max_tokens || 4096);
    setSaveSuccess(false);
    setEditorTab("prompt");

    // Load version history
    const { data: versionHistory } = await supabase
      .from("prompt_versions")
      .select("*")
      .eq("prompt_set_id", prompt.id)
      .order("version", { ascending: false })
      .limit(10);

    setVersions(versionHistory || []);

    // Load guideline defaults for this prompt
    const { data: defaults } = await supabase
      .from("prompt_guidelines")
      .select("guideline_id")
      .eq("prompt_set_id", prompt.id)
      .eq("is_default", true);

    setGuidelineDefaults(new Set((defaults || []).map((d) => d.guideline_id)));
  };

  const closeEditor = () => {
    setEditingPrompt(null);
    setShowVersions(false);
    setShowPreview(false);
    setGuidelineDefaults(new Set());
    setEditorTab("prompt");
  };

  const toggleGuidelineDefault = (guidelineId: string) => {
    setGuidelineDefaults((prev) => {
      const next = new Set(prev);
      if (next.has(guidelineId)) {
        next.delete(guidelineId);
      } else {
        next.add(guidelineId);
      }
      return next;
    });
  };

  const saveGuidelineDefaults = async () => {
    if (!editingPrompt) return;

    try {
      // Delete existing defaults
      await supabase
        .from("prompt_guidelines")
        .delete()
        .eq("prompt_set_id", editingPrompt.id);

      // Insert new defaults
      if (guidelineDefaults.size > 0) {
        await supabase.from("prompt_guidelines").insert(
          Array.from(guidelineDefaults).map((guidelineId) => ({
            prompt_set_id: editingPrompt.id,
            guideline_id: guidelineId,
            is_default: true,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to save guideline defaults:", err);
      setError(err instanceof Error ? err.message : "Failed to save guideline defaults");
    }
  };

  const savePrompt = async () => {
    if (!editingPrompt) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Get current max version
      const { data: maxVersion } = await supabase
        .from("prompt_versions")
        .select("version")
        .eq("prompt_set_id", editingPrompt.id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = (maxVersion?.version || 0) + 1;

      // Archive the current active version
      if (editingPrompt.current_version_id) {
        await supabase
          .from("prompt_versions")
          .update({ status: "archived" })
          .eq("id", editingPrompt.current_version_id);
      }

      // Create new version
      const { data: newVersionData, error: insertError } = await supabase
        .from("prompt_versions")
        .insert({
          prompt_set_id: editingPrompt.id,
          version: newVersion,
          prompt_content: editorContent,
          model_id: editorModelId || null,
          api_config: { temperature: editorTemperature, max_tokens: editorMaxTokens },
          status: "active",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update prompt_set to point to new version
      await supabase
        .from("prompt_sets")
        .update({ current_version_id: newVersionData.id })
        .eq("id", editingPrompt.id);

      // Archive old versions beyond 5
      const { data: allVersions } = await supabase
        .from("prompt_versions")
        .select("id, version")
        .eq("prompt_set_id", editingPrompt.id)
        .order("version", { ascending: false });

      if (allVersions && allVersions.length > 5) {
        const toArchive = allVersions.slice(5).map((v) => v.id);
        await supabase
          .from("prompt_versions")
          .update({ status: "archived" })
          .in("id", toArchive);
      }

      // Save guideline defaults
      await saveGuidelineDefaults();

      setSaveSuccess(true);
      await loadPrompts();

      // Refresh version history
      const { data: versionHistory } = await supabase
        .from("prompt_versions")
        .select("*")
        .eq("prompt_set_id", editingPrompt.id)
        .order("version", { ascending: false })
        .limit(10);

      setVersions(versionHistory || []);
    } catch (err) {
      console.error("Save failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save prompt");
    } finally {
      setIsSaving(false);
    }
  };

  const restoreVersion = async (version: PromptVersion) => {
    setEditorContent(version.prompt_content);
    setEditorModelId(version.model_id || "");
    setEditorTemperature(version.api_config?.temperature || 0.7);
    setEditorMaxTokens(version.api_config?.max_tokens || 4096);
    setShowVersions(false);
  };

  // Extract variables from prompt content ({{variable_name}})
  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.slice(2, -2)))];
  };

  const getInterpolatedPreview = (): string => {
    let preview = editorContent;
    for (const [key, value] of Object.entries(previewVariables)) {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `[${key}]`);
    }
    return preview;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "extraction":
        return <Search className="h-4 w-4" />;
      case "generation":
        return <MessageSquare className="h-4 w-4" />;
      case "analysis":
        return <FlaskConical className="h-4 w-4" />;
      case "image_generation":
        return <Image className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "extraction":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "generation":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "analysis":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "image_generation":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getModelTypeBadge = (modelType?: string) => {
    if (!modelType) return null;
    const colors: Record<string, string> = {
      text: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      image: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      research: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    };
    return (
      <Badge variant="outline" className={colors[modelType] || ""}>
        {modelType.toUpperCase()}
      </Badge>
    );
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {prompts.map((prompt) => (
          <Card
            key={prompt.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => openEditor(prompt)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getTypeIcon(prompt.prompt_type)}
                    <span className="truncate">{prompt.name}</span>
                  </CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {prompt.description || prompt.slug}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Badge variant="secondary" className={getTypeColor(prompt.prompt_type)}>
                    {prompt.prompt_type}
                  </Badge>
                  {prompt.model && getModelTypeBadge(prompt.model.model_type)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {prompt.current_version
                    ? `v${prompt.current_version.version}`
                    : "No version"}
                </span>
                <span className="truncate max-w-[150px]">
                  {prompt.model?.display_name || "No model"}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditor(prompt);
                  }}
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/studio/test?prompt=${prompt.slug}`}>
                    <FlaskConical className="mr-1 h-3 w-3" />
                    Test
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editor Dialog */}
      <Dialog open={!!editingPrompt} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {editingPrompt?.name}
              {editingPrompt?.model && (
                <span className="ml-2">
                  {getModelTypeBadge(editingPrompt.model.model_type)}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>{editingPrompt?.description}</DialogDescription>
          </DialogHeader>

          <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as "prompt" | "guidelines")} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="prompt" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Prompt
              </TabsTrigger>
              <TabsTrigger value="guidelines" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Guidelines
                {guidelineDefaults.size > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {guidelineDefaults.size}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden flex gap-4 mt-4">
              <TabsContent value="prompt" className="flex-1 flex flex-col gap-4 mt-0 data-[state=inactive]:hidden">
                {/* Model and Config Row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={editorModelId} onValueChange={setEditorModelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center gap-2">
                              <span>{model.display_name}</span>
                              <Badge variant="outline" className="text-[10px] px-1">
                                {model.model_type}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Temperature ({editorTemperature})</Label>
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={editorTemperature}
                      onChange={(e) => setEditorTemperature(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={editorMaxTokens}
                      onChange={(e) => setEditorMaxTokens(parseInt(e.target.value) || 4096)}
                    />
                  </div>
                </div>

                {/* Prompt Content */}
                <div className="flex-1 space-y-2">
                  <Label>Prompt Content</Label>
                  <Textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    className="h-[300px] font-mono text-sm resize-none"
                    placeholder="Enter your prompt here. Use {{variable}} for interpolation."
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowVersions(!showVersions)}
                    >
                      <History className="mr-2 h-4 w-4" />
                      History
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const vars = extractVariables(editorContent);
                        setPreviewVariables(
                          Object.fromEntries(vars.map((v) => [v, previewVariables[v] || ""]))
                        );
                        setShowPreview(!showPreview);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                    {editingPrompt && (
                      <Button variant="outline" asChild>
                        <Link href={`/studio/test?prompt=${editingPrompt.slug}`}>
                          <FlaskConical className="mr-2 h-4 w-4" />
                          Test
                        </Link>
                      </Button>
                    )}
                  </div>
                  <Button onClick={savePrompt} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save New Version
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="guidelines" className="flex-1 mt-0 data-[state=inactive]:hidden">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select which brand guidelines should be included by default when using this prompt.
                    These become template variables like <code className="bg-muted px-1 rounded">{"{{image_guidelines}}"}</code>.
                  </p>

                  {guidelines.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No guidelines available.</p>
                      <p className="text-sm">Create guidelines in the Guidelines tab.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-6">
                        {/* Group by category */}
                        {Object.entries(
                          guidelines.reduce((acc, g) => {
                            if (!acc[g.category]) acc[g.category] = [];
                            acc[g.category].push(g);
                            return acc;
                          }, {} as Record<string, BrandGuideline[]>)
                        ).map(([category, categoryGuidelines]) => (
                          <div key={category} className="space-y-3">
                            <h4 className="font-medium capitalize flex items-center gap-2">
                              {category}
                              <Badge variant="outline" className="text-xs">
                                {"{{" + category + "_guidelines}}"}
                              </Badge>
                            </h4>
                            <div className="space-y-2 pl-2">
                              {categoryGuidelines.map((guideline) => (
                                <div
                                  key={guideline.id}
                                  className="flex items-start gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer"
                                  onClick={() => toggleGuidelineDefault(guideline.id)}
                                >
                                  <Checkbox
                                    checked={guidelineDefaults.has(guideline.id)}
                                    onCheckedChange={() => toggleGuidelineDefault(guideline.id)}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-sm">{guideline.name}</span>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                      {guideline.content}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={savePrompt} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : saveSuccess ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Version History Sidebar */}
              {showVersions && (
                <div className="w-64 border-l pl-4">
                  <h3 className="font-medium mb-2">Version History</h3>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="p-2 border rounded-lg hover:bg-muted cursor-pointer"
                          onClick={() => restoreVersion(version)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">v{version.version}</span>
                            <Badge
                              variant={version.status === "active" ? "default" : "secondary"}
                            >
                              {version.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(version.created_at).toLocaleDateString()}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreVersion(version);
                            }}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Restore
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Preview Panel */}
              {showPreview && (
                <div className="w-80 border-l pl-4">
                  <h3 className="font-medium mb-2">Preview</h3>
                  <div className="space-y-3">
                    {extractVariables(editorContent).map((varName) => (
                      <div key={varName} className="space-y-1">
                        <Label className="text-xs">{varName}</Label>
                        <Input
                          value={previewVariables[varName] || ""}
                          onChange={(e) =>
                            setPreviewVariables({ ...previewVariables, [varName]: e.target.value })
                          }
                          placeholder={`Enter ${varName}`}
                        />
                      </div>
                    ))}
                  </div>
                  <Separator className="my-3" />
                  <ScrollArea className="h-[250px]">
                    <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-lg">
                      {getInterpolatedPreview()}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
