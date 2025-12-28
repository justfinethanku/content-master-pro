"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  X,
  GripVertical,
  Image,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { BrandGuideline } from "@/lib/supabase/guidelines";
import { DEFAULT_IMAGE_GUIDELINES } from "@/lib/supabase/guidelines";

interface GuidelinesManagerProps {
  className?: string;
}

const CATEGORY_INFO: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  image: {
    label: "Image",
    icon: Image,
    description: "Guidelines for AI image generation (thumbnails, headers, social)",
  },
  voice: {
    label: "Voice",
    icon: Mic,
    description: "Guidelines for writing tone and voice",
  },
};

export function GuidelinesManager({ className = "" }: GuidelinesManagerProps) {
  const [guidelines, setGuidelines] = useState<Record<string, BrandGuideline[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("image");
  const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BrandGuideline | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    category: "image",
    slug: "",
    name: "",
    content: "",
  });

  const supabase = createClient();

  const loadGuidelines = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from("brand_guidelines")
        .select("*")
        .order("sort_order", { ascending: true });

      if (loadError) throw loadError;

      // Group by category
      const grouped: Record<string, BrandGuideline[]> = {};
      for (const guideline of data || []) {
        if (!grouped[guideline.category]) {
          grouped[guideline.category] = [];
        }
        grouped[guideline.category].push(guideline);
      }

      setGuidelines(grouped);

      // If no guidelines exist, seed defaults
      if (!data || data.length === 0) {
        await seedDefaults();
      }
    } catch (err) {
      console.error("Failed to load guidelines:", err);
      setError(err instanceof Error ? err.message : "Failed to load guidelines");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const seedDefaults = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error: insertError } = await supabase.from("brand_guidelines").insert(
        DEFAULT_IMAGE_GUIDELINES.map((g, i) => ({
          ...g,
          user_id: userData.user!.id,
          sort_order: i,
        }))
      );

      if (insertError) throw insertError;

      // Reload after seeding
      await loadGuidelines();
    } catch (err) {
      console.error("Failed to seed defaults:", err);
    }
  };

  useEffect(() => {
    loadGuidelines();
  }, [loadGuidelines]);

  const openCreate = () => {
    setFormData({
      category: activeTab,
      slug: "",
      name: "",
      content: "",
    });
    setIsCreateOpen(true);
  };

  const openEdit = (guideline: BrandGuideline) => {
    setFormData({
      category: guideline.category,
      slug: guideline.slug,
      name: guideline.name,
      content: guideline.content,
    });
    setEditingGuideline(guideline);
  };

  const closeDialogs = () => {
    setIsCreateOpen(false);
    setEditingGuideline(null);
    setFormData({
      category: "image",
      slug: "",
      name: "",
      content: "",
    });
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.content) {
      setError("Name and content are required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const slug = formData.slug || generateSlug(formData.name);
      const currentCount = guidelines[formData.category]?.length || 0;

      const { error: insertError } = await supabase.from("brand_guidelines").insert({
        user_id: userData.user.id,
        category: formData.category,
        slug,
        name: formData.name,
        content: formData.content,
        is_active: true,
        sort_order: currentCount,
      });

      if (insertError) throw insertError;

      closeDialogs();
      await loadGuidelines();
    } catch (err) {
      console.error("Failed to create guideline:", err);
      setError(err instanceof Error ? err.message : "Failed to create guideline");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingGuideline || !formData.name || !formData.content) {
      setError("Name and content are required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("brand_guidelines")
        .update({
          name: formData.name,
          content: formData.content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingGuideline.id);

      if (updateError) throw updateError;

      closeDialogs();
      await loadGuidelines();
    } catch (err) {
      console.error("Failed to update guideline:", err);
      setError(err instanceof Error ? err.message : "Failed to update guideline");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("brand_guidelines")
        .delete()
        .eq("id", deleteTarget.id);

      if (deleteError) throw deleteError;

      setDeleteTarget(null);
      await loadGuidelines();
    } catch (err) {
      console.error("Failed to delete guideline:", err);
      setError(err instanceof Error ? err.message : "Failed to delete guideline");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (guideline: BrandGuideline) => {
    try {
      const { error: updateError } = await supabase
        .from("brand_guidelines")
        .update({ is_active: !guideline.is_active })
        .eq("id", guideline.id);

      if (updateError) throw updateError;
      await loadGuidelines();
    } catch (err) {
      console.error("Failed to toggle guideline:", err);
      setError(err instanceof Error ? err.message : "Failed to toggle guideline");
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Brand Guidelines</CardTitle>
              <CardDescription>
                Manage guidelines used by AI for generating content and images
              </CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Guideline
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              {Object.entries(CATEGORY_INFO).map(([key, info]) => {
                const Icon = info.icon;
                const count = guidelines[key]?.length || 0;
                return (
                  <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {info.label}
                    <Badge variant="secondary" className="ml-1">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(CATEGORY_INFO).map(([key, info]) => (
              <TabsContent key={key} value={key} className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">{info.description}</p>

                {(!guidelines[key] || guidelines[key].length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No {info.label.toLowerCase()} guidelines yet.</p>
                    <Button variant="link" onClick={openCreate}>
                      Create your first one
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {guidelines[key].map((guideline) => (
                      <div
                        key={guideline.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border bg-card transition-opacity ${
                          !guideline.is_active ? "opacity-50" : ""
                        }`}
                      >
                        <GripVertical className="h-5 w-5 text-muted-foreground/50 mt-0.5 cursor-grab" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{guideline.name}</span>
                            {!guideline.is_active && (
                              <Badge variant="outline" className="text-xs">
                                Disabled
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {guideline.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleActive(guideline)}
                            title={guideline.is_active ? "Disable" : "Enable"}
                          >
                            <span className={`h-2 w-2 rounded-full ${guideline.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(guideline)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(guideline)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Guideline</DialogTitle>
            <DialogDescription>
              Create a new brand guideline for AI-generated content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Cinematic Realism"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-content">Guideline Content</Label>
              <Textarea
                id="create-content"
                value={formData.content}
                onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Describe the guideline for the AI to follow..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingGuideline} onOpenChange={() => closeDialogs()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Guideline</DialogTitle>
            <DialogDescription>
              Update this brand guideline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Guideline Content</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guideline?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
