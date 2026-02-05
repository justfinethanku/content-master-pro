"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Newspaper,
  Edit,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Video,
  Mail,
} from "lucide-react";
import {
  usePublications,
  useCreatePublication,
  useUpdatePublication,
} from "@/hooks/use-routing-config";
import type { Publication, PublicationInsert, PublicationType } from "@/lib/types";

export default function PublicationsPage() {
  const { data: publications = [], isLoading, error } = usePublications();
  const createMutation = useCreatePublication();
  const updateMutation = useUpdatePublication();

  const [editingPublication, setEditingPublication] =
    useState<Publication | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editorData, setEditorData] = useState<Partial<PublicationInsert>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const openEditor = (publication: Publication) => {
    setEditingPublication(publication);
    setIsCreating(false);
    setEditorData({
      name: publication.name,
      slug: publication.slug,
      publication_type: publication.publication_type,
      weekly_target: publication.weekly_target,
      unified_with: publication.unified_with,
      is_active: publication.is_active,
    });
    setSaveSuccess(false);
  };

  const openCreateDialog = () => {
    setEditingPublication(null);
    setIsCreating(true);
    setEditorData({
      name: "",
      slug: "",
      publication_type: "newsletter",
      weekly_target: 3,
      is_active: true,
    });
    setSaveSuccess(false);
  };

  const closeEditor = () => {
    setEditingPublication(null);
    setIsCreating(false);
    setEditorData({});
    setSaveSuccess(false);
  };

  const savePublication = async () => {
    try {
      if (isCreating) {
        await createMutation.mutateAsync(editorData as PublicationInsert);
      } else if (editingPublication) {
        await updateMutation.mutateAsync({
          id: editingPublication.id,
          updates: editorData,
        });
      }
      setSaveSuccess(true);
      setTimeout(closeEditor, 500);
    } catch {
      // Error handled by mutation
    }
  };

  const getTypeIcon = (type: PublicationType) => {
    switch (type) {
      case "video":
        return <Video className="h-5 w-5" />;
      case "newsletter":
        return <Mail className="h-5 w-5" />;
      default:
        return <Newspaper className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: PublicationType): string => {
    switch (type) {
      case "video":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "newsletter":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const publicationsByType = publications.reduce(
    (acc, pub) => {
      const type = pub.publication_type || "newsletter";
      if (!acc[type]) acc[type] = [];
      acc[type].push(pub);
      return acc;
    },
    {} as Record<string, Publication[]>
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

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
          {publications.length} publications •{" "}
          {publications.filter((p) => p.is_active).length} active
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Publication
        </Button>
      </div>

      {(error || mutationError) && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error?.message || mutationError?.message}
          </p>
        </div>
      )}

      {Object.entries(publicationsByType).map(([type, typePubs]) => (
        <div key={type} className="space-y-3">
          <h2 className="text-lg font-semibold capitalize flex items-center gap-2">
            {getTypeIcon(type as PublicationType)}
            {type}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {typePubs.map((pub) => (
              <Card
                key={pub.id}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${
                  !pub.is_active ? "opacity-50" : ""
                }`}
                onClick={() => openEditor(pub)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getTypeIcon(pub.publication_type)}
                        <span className="truncate">{pub.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        Slug: {pub.slug}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={getTypeColor(pub.publication_type)}
                    >
                      {pub.publication_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Weekly target: {pub.weekly_target} posts</p>
                    {pub.unified_with && (
                      <p>Unified with: {publications.find(p => p.id === pub.unified_with)?.name || pub.unified_with}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {publications.length === 0 && (
        <div className="text-center py-12">
          <Newspaper className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No publications configured.</p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Publication
          </Button>
        </div>
      )}

      <Dialog
        open={!!editingPublication || isCreating}
        onOpenChange={(open) => !open && closeEditor()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <Plus className="h-5 w-5" />
                  New Publication
                </>
              ) : (
                <>
                  <Edit className="h-5 w-5" />
                  {editingPublication?.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Create a new publication for content routing."
                : `Configure settings for ${editingPublication?.name}`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editorData.name || ""}
                  onChange={(e) =>
                    setEditorData({ ...editorData, name: e.target.value })
                  }
                  placeholder="Core Substack"
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
                  placeholder="core_substack"
                  disabled={!isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={editorData.publication_type || "newsletter"}
                  onValueChange={(v) =>
                    setEditorData({ ...editorData, publication_type: v as PublicationType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Weekly Target</Label>
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={editorData.weekly_target ?? 3}
                  onChange={(e) =>
                    setEditorData({
                      ...editorData,
                      weekly_target: parseInt(e.target.value) || 3,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Unified With (optional)</Label>
                <Select
                  value={editorData.unified_with || "none"}
                  onValueChange={(v) =>
                    setEditorData({
                      ...editorData,
                      unified_with: v === "none" ? undefined : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {publications
                      .filter((p) => p.id !== editingPublication?.id)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editorData.is_active ?? true}
                  onCheckedChange={(checked) =>
                    setEditorData({ ...editorData, is_active: checked })
                  }
                />
                <Label>Active</Label>
              </div>
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button onClick={savePublication} disabled={isSaving}>
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
                  {isCreating ? "Create" : "Save"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
