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
  Globe,
  Edit,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Video,
  MessageSquare,
  Mail,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Destination {
  id: string;
  slug: string;
  name: string;
  category: string;
  specs: Record<string, unknown>;
  prompt_instructions: string | null;
  tone_modifiers: string[] | null;
  is_active: boolean;
  sort_order: number;
}

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editorData, setEditorData] = useState<Partial<Destination>>({});
  const [specsJson, setSpecsJson] = useState("");
  const [toneInput, setToneInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const supabase = createClient();

  const loadDestinations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("destinations")
        .select("*")
        .order("category")
        .order("sort_order");

      if (fetchError) throw fetchError;
      setDestinations(data || []);
    } catch (err) {
      console.error("Failed to load destinations:", err);
      setError(err instanceof Error ? err.message : "Failed to load destinations");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  const openEditor = (destination: Destination) => {
    setEditingDestination(destination);
    setIsCreating(false);
    setEditorData({ ...destination });
    setSpecsJson(JSON.stringify(destination.specs, null, 2));
    setToneInput((destination.tone_modifiers || []).join(", "));
    setSaveSuccess(false);
  };

  const openCreateDialog = () => {
    setEditingDestination(null);
    setIsCreating(true);
    setEditorData({
      name: "",
      slug: "",
      category: "social",
      specs: {},
      prompt_instructions: "",
      tone_modifiers: [],
      is_active: true,
      sort_order: destinations.length,
    });
    setSpecsJson("{}");
    setToneInput("");
    setSaveSuccess(false);
  };

  const closeEditor = () => {
    setEditingDestination(null);
    setIsCreating(false);
    setEditorData({});
    setSpecsJson("");
    setToneInput("");
    setSaveSuccess(false);
  };

  const saveDestination = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      // Parse specs JSON
      let specs = {};
      try {
        specs = JSON.parse(specsJson);
      } catch {
        throw new Error("Invalid JSON in specs field");
      }

      // Parse tone modifiers
      const toneModifiers = toneInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const dataToSave = {
        name: editorData.name,
        slug: editorData.slug,
        category: editorData.category,
        specs,
        prompt_instructions: editorData.prompt_instructions || null,
        tone_modifiers: toneModifiers.length > 0 ? toneModifiers : null,
        is_active: editorData.is_active,
        sort_order: editorData.sort_order,
      };

      if (isCreating) {
        const { error: insertError } = await supabase
          .from("destinations")
          .insert(dataToSave);

        if (insertError) throw insertError;
      } else if (editingDestination) {
        const { error: updateError } = await supabase
          .from("destinations")
          .update(dataToSave)
          .eq("id", editingDestination.id);

        if (updateError) throw updateError;
      }

      setSaveSuccess(true);
      await loadDestinations();

      // Close after short delay to show success
      setTimeout(() => {
        closeEditor();
      }, 500);
    } catch (err) {
      console.error("Save failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save destination");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDestination = async () => {
    if (!editingDestination) return;

    if (!confirm(`Delete "${editingDestination.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("destinations")
        .delete()
        .eq("id", editingDestination.id);

      if (deleteError) throw deleteError;

      await loadDestinations();
      closeEditor();
    } catch (err) {
      console.error("Delete failed:", err);
      setError(err instanceof Error ? err.message : "Failed to delete destination");
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "video":
        return <Video className="h-5 w-5" />;
      case "newsletter":
        return <Mail className="h-5 w-5" />;
      case "social":
        return <MessageSquare className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case "video":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "newsletter":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "social":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSpecsSummary = (specs: Record<string, unknown>): string => {
    const parts: string[] = [];

    if (specs.video) {
      const video = specs.video as Record<string, unknown>;
      if (video.aspect_ratio) parts.push(video.aspect_ratio as string);
      if (video.max_duration_seconds) parts.push(`${video.max_duration_seconds}s max`);
    }

    if (specs.text) {
      const text = specs.text as Record<string, unknown>;
      if (text.max_characters) parts.push(`${text.max_characters} chars`);
      if (text.supports_markdown) parts.push("Markdown");
    }

    return parts.join(" • ") || "No specs defined";
  };

  // Group by category
  const destinationsByCategory = destinations.reduce((acc, dest) => {
    if (!acc[dest.category]) acc[dest.category] = [];
    acc[dest.category].push(dest);
    return acc;
  }, {} as Record<string, Destination[]>);

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
          {destinations.length} destinations • {destinations.filter((d) => d.is_active).length} active
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Destination
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

      {Object.entries(destinationsByCategory).map(([category, categoryDestinations]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-lg font-semibold capitalize flex items-center gap-2">
            {getCategoryIcon(category)}
            {category}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categoryDestinations.map((destination) => (
              <Card
                key={destination.id}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${
                  !destination.is_active ? "opacity-50" : ""
                }`}
                onClick={() => openEditor(destination)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getCategoryIcon(destination.category)}
                        <span className="truncate">{destination.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {getSpecsSummary(destination.specs)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={getCategoryColor(destination.category)}>
                      {destination.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {destination.prompt_instructions && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {destination.prompt_instructions}
                    </p>
                  )}
                  {destination.tone_modifiers && destination.tone_modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {destination.tone_modifiers.slice(0, 3).map((tone, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {tone}
                        </Badge>
                      ))}
                      {destination.tone_modifiers.length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{destination.tone_modifiers.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {destinations.length === 0 && (
        <div className="text-center py-12">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No destinations configured.</p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Destination
          </Button>
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={!!editingDestination || isCreating} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <Plus className="h-5 w-5" />
                  New Destination
                </>
              ) : (
                <>
                  <Edit className="h-5 w-5" />
                  {editingDestination?.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Create a new platform destination for content generation."
                : `Configure settings for ${editingDestination?.name}`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-6 pr-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editorData.name || ""}
                    onChange={(e) => setEditorData({ ...editorData, name: e.target.value })}
                    placeholder="YouTube Shorts"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={editorData.slug || ""}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        slug: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                      })
                    }
                    placeholder="youtube_shorts"
                    disabled={!isCreating}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={editorData.category || ""}
                    onValueChange={(v) => setEditorData({ ...editorData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={editorData.sort_order ?? 0}
                    onChange={(e) =>
                      setEditorData({ ...editorData, sort_order: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editorData.is_active ?? true}
                  onCheckedChange={(checked) => setEditorData({ ...editorData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>

              <Separator />

              {/* Specs */}
              <div className="space-y-2">
                <Label>Platform Specs (JSON)</Label>
                <Textarea
                  value={specsJson}
                  onChange={(e) => setSpecsJson(e.target.value)}
                  placeholder={`{
  "video": {
    "aspect_ratio": "16:9",
    "max_duration_seconds": 600
  }
}`}
                  className="min-h-[150px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Define platform constraints: aspect_ratio, max_duration, character limits, etc.
                </p>
              </div>

              <Separator />

              {/* Prompt Instructions */}
              <div className="space-y-2">
                <Label>Prompt Instructions</Label>
                <Textarea
                  value={editorData.prompt_instructions || ""}
                  onChange={(e) =>
                    setEditorData({ ...editorData, prompt_instructions: e.target.value })
                  }
                  placeholder="Write for spoken delivery. Include [B-ROLL] markers. Hook in first 30 seconds."
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  These instructions are injected into prompts when this destination is selected.
                </p>
              </div>

              {/* Tone Modifiers */}
              <div className="space-y-2">
                <Label>Tone Modifiers</Label>
                <Input
                  value={toneInput}
                  onChange={(e) => setToneInput(e.target.value)}
                  placeholder="conversational, hook-driven, visual"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of tone keywords.
                </p>
              </div>
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          <div className="flex justify-between">
            {editingDestination && (
              <Button variant="destructive" onClick={deleteDestination}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeEditor}>
                Cancel
              </Button>
              <Button onClick={saveDestination} disabled={isSaving}>
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
                    {isCreating ? "Create" : "Save Changes"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
