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
import { Switch } from "@/components/ui/switch";
import {
  Cpu,
  Edit,
  Save,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  Zap,
  Image,
  Search,
  MessageSquare,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AIModel {
  id: string;
  model_id: string;
  provider: string;
  display_name: string;
  model_type: string;
  context_window: number | null;
  max_output_tokens: number | null;
  is_available: boolean;
  supports_streaming: boolean;
  supports_images: boolean;
  system_prompt_tips: string | null;
  preferred_format: string | null;
  format_instructions: string | null;
  quirks: string[] | null;
  image_config: Record<string, unknown> | null;
  research_config: Record<string, unknown> | null;
  default_temperature: number | null;
  default_max_tokens: number | null;
  api_endpoint_override: string | null;
  api_notes: string | null;
}

export default function ModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [editorData, setEditorData] = useState<Partial<AIModel>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const supabase = createClient();

  const loadModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("ai_models")
        .select("*")
        .order("provider")
        .order("display_name");

      if (fetchError) throw fetchError;
      setModels(data || []);
    } catch (err) {
      console.error("Failed to load models:", err);
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const syncModels = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/sync-models", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync models");
      }

      await loadModels();
    } catch (err) {
      console.error("Failed to sync models:", err);
      setError(err instanceof Error ? err.message : "Failed to sync models");
    } finally {
      setIsSyncing(false);
    }
  };

  const openEditor = (model: AIModel) => {
    setEditingModel(model);
    setEditorData({ ...model });
    setSaveSuccess(false);
  };

  const closeEditor = () => {
    setEditingModel(null);
    setEditorData({});
    setSaveSuccess(false);
  };

  const saveModel = async () => {
    if (!editingModel) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from("ai_models")
        .update({
          system_prompt_tips: editorData.system_prompt_tips,
          preferred_format: editorData.preferred_format,
          format_instructions: editorData.format_instructions,
          quirks: editorData.quirks,
          default_temperature: editorData.default_temperature,
          default_max_tokens: editorData.default_max_tokens,
          api_notes: editorData.api_notes,
          is_available: editorData.is_available,
        })
        .eq("id", editingModel.id);

      if (updateError) throw updateError;

      setSaveSuccess(true);
      await loadModels();
    } catch (err) {
      console.error("Save failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save model");
    } finally {
      setIsSaving(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <MessageSquare className="h-5 w-5" />;
      case "image":
        return <Image className="h-5 w-5" />;
      case "research":
        return <Search className="h-5 w-5" />;
      default:
        return <Cpu className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "text":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "image":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "research":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatNumber = (num: number | null): string => {
    if (num === null) return "N/A";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toString();
  };

  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, AIModel[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {models.length} models configured • {models.filter((m) => m.is_available).length} available
        </p>
        <Button variant="outline" onClick={syncModels} disabled={isSyncing}>
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Models
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
        <div key={provider} className="space-y-3">
          <h2 className="text-lg font-semibold capitalize">{provider}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providerModels.map((model) => (
              <Card
                key={model.id}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${
                  !model.is_available ? "opacity-50" : ""
                }`}
                onClick={() => openEditor(model)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getTypeIcon(model.model_type)}
                        <span className="truncate">{model.display_name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs truncate">
                        {model.model_id}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={getTypeColor(model.model_type)}>
                      {model.model_type.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatNumber(model.context_window)} ctx</span>
                    <span>{formatNumber(model.max_output_tokens)} out</span>
                    <div className="flex items-center gap-1 ml-auto">
                      {model.supports_streaming && (
                        <Badge variant="secondary" className="text-[10px] px-1">
                          <Zap className="h-2.5 w-2.5" />
                        </Badge>
                      )}
                      {model.supports_images && (
                        <Badge variant="secondary" className="text-[10px] px-1">
                          <Image className="h-2.5 w-2.5" />
                        </Badge>
                      )}
                    </div>
                  </div>
                  {model.system_prompt_tips && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Info className="h-3 w-3" />
                      <span className="truncate">Has prompting tips</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Editor Dialog */}
      <Dialog open={!!editingModel} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingModel && getTypeIcon(editingModel.model_type)}
              {editingModel?.display_name}
            </DialogTitle>
            <DialogDescription>{editingModel?.model_id}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-6 pr-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-xs text-muted-foreground">Provider</Label>
                  <p className="font-medium capitalize">{editingModel?.provider}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <p className="font-medium uppercase">{editingModel?.model_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Context Window</Label>
                  <p className="font-medium">{formatNumber(editingModel?.context_window || null)} tokens</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max Output</Label>
                  <p className="font-medium">{formatNumber(editingModel?.max_output_tokens || null)} tokens</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={editingModel?.supports_streaming ? "default" : "secondary"}>
                    {editingModel?.supports_streaming ? "Streaming" : "No Streaming"}
                  </Badge>
                  <Badge variant={editingModel?.supports_images ? "default" : "secondary"}>
                    {editingModel?.supports_images ? "Images" : "No Images"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Available</Label>
                  <Switch
                    checked={editorData.is_available}
                    onCheckedChange={(checked) =>
                      setEditorData({ ...editorData, is_available: checked })
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Prompting Guidance */}
              <div className="space-y-4">
                <h3 className="font-medium">Prompting Guidance</h3>

                <div className="space-y-2">
                  <Label>System Prompt Tips</Label>
                  <Textarea
                    value={editorData.system_prompt_tips || ""}
                    onChange={(e) =>
                      setEditorData({ ...editorData, system_prompt_tips: e.target.value })
                    }
                    placeholder="Tips for writing effective prompts with this model..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preferred Format</Label>
                    <Select
                      value={editorData.preferred_format || ""}
                      onValueChange={(v) =>
                        setEditorData({ ...editorData, preferred_format: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="xml">XML</SelectItem>
                        <SelectItem value="markdown">Markdown</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="plain">Plain Text</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default Temperature</Label>
                    <Input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={editorData.default_temperature ?? ""}
                      onChange={(e) =>
                        setEditorData({
                          ...editorData,
                          default_temperature: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="0.7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Format Instructions</Label>
                  <Textarea
                    value={editorData.format_instructions || ""}
                    onChange={(e) =>
                      setEditorData({ ...editorData, format_instructions: e.target.value })
                    }
                    placeholder="Specific formatting instructions for this model..."
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Max Tokens</Label>
                  <Input
                    type="number"
                    value={editorData.default_max_tokens ?? ""}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        default_max_tokens: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="4096"
                  />
                </div>
              </div>

              <Separator />

              {/* Type-Specific Config */}
              {editingModel?.model_type === "image" && editingModel.image_config && (
                <div className="space-y-4">
                  <h3 className="font-medium">Image Configuration</h3>
                  <pre className="p-4 rounded-lg bg-muted text-xs overflow-auto">
                    {JSON.stringify(editingModel.image_config, null, 2)}
                  </pre>
                </div>
              )}

              {editingModel?.model_type === "research" && editingModel.research_config && (
                <div className="space-y-4">
                  <h3 className="font-medium">Research Configuration</h3>
                  <pre className="p-4 rounded-lg bg-muted text-xs overflow-auto">
                    {JSON.stringify(editingModel.research_config, null, 2)}
                  </pre>
                </div>
              )}

              {/* API Notes */}
              <div className="space-y-2">
                <Label>API Notes</Label>
                <Textarea
                  value={editorData.api_notes || ""}
                  onChange={(e) =>
                    setEditorData({ ...editorData, api_notes: e.target.value })
                  }
                  placeholder="Developer notes about this model's API..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button onClick={saveModel} disabled={isSaving}>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
