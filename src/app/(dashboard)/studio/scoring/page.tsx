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
import { Textarea } from "@/components/ui/textarea";
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
  Calculator,
  Edit,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Scale,
} from "lucide-react";
import {
  useScoringRubrics,
  usePublications,
  useCreateScoringRubric,
  useUpdateScoringRubric,
  useDeleteScoringRubric,
} from "@/hooks/use-routing-config";
import type { ScoringRubric, ScoringRubricInsert } from "@/lib/types";

export default function ScoringPage() {
  const { data: rubrics = [], isLoading, error } = useScoringRubrics();
  const { data: publications = [] } = usePublications();
  const createMutation = useCreateScoringRubric();
  const updateMutation = useUpdateScoringRubric();
  const deleteMutation = useDeleteScoringRubric();

  const [editingRubric, setEditingRubric] = useState<ScoringRubric | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editorData, setEditorData] = useState<Partial<ScoringRubricInsert> & { publication_slug?: string }>({});
  const [criteriaJson, setCriteriaJson] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const rubricsByPublication = rubrics.reduce(
    (acc, rubric) => {
      const pub = rubric.publication_id || "general";
      if (!acc[pub]) acc[pub] = [];
      acc[pub].push(rubric);
      return acc;
    },
    {} as Record<string, ScoringRubric[]>
  );

  const openEditor = (rubric: ScoringRubric) => {
    setEditingRubric(rubric);
    setIsCreating(false);
    const pub = publications.find(p => p.id === rubric.publication_id);
    setEditorData({
      publication_id: rubric.publication_id,
      publication_slug: pub?.slug,
      slug: rubric.slug,
      name: rubric.name,
      description: rubric.description,
      weight: rubric.weight,
      is_modifier: rubric.is_modifier,
      baseline_score: rubric.baseline_score,
      is_active: rubric.is_active,
    });
    setCriteriaJson(JSON.stringify(rubric.criteria, null, 2));
    setSaveSuccess(false);
  };

  const openCreateDialog = () => {
    setEditingRubric(null);
    setIsCreating(true);
    setEditorData({
      publication_slug: publications[0]?.slug || "",
      slug: "",
      name: "",
      description: "",
      weight: 1.0,
      is_modifier: false,
      baseline_score: 5.0,
      is_active: true,
    });
    setCriteriaJson("[]");
    setSaveSuccess(false);
  };

  const closeEditor = () => {
    setEditingRubric(null);
    setIsCreating(false);
    setEditorData({});
    setCriteriaJson("");
    setSaveSuccess(false);
  };

  const saveRubric = async () => {
    try {
      let criteria;
      try {
        criteria = JSON.parse(criteriaJson);
      } catch {
        throw new Error("Invalid JSON in criteria field");
      }

      if (isCreating) {
        const pub = publications.find(p => p.slug === editorData.publication_slug);
        if (!pub) throw new Error("Publication not found");

        const insertData = {
          publication_id: pub.id,
          publication_slug: editorData.publication_slug!,
          slug: editorData.slug!,
          name: editorData.name!,
          description: editorData.description,
          weight: editorData.weight || 1.0,
          criteria,
          is_modifier: editorData.is_modifier || false,
          baseline_score: editorData.baseline_score || 5.0,
          is_active: editorData.is_active ?? true,
        };
        await createMutation.mutateAsync(insertData as ScoringRubricInsert & { publication_slug: string });
      } else if (editingRubric) {
        await updateMutation.mutateAsync({
          id: editingRubric.id,
          updates: {
            name: editorData.name,
            description: editorData.description,
            weight: editorData.weight,
            criteria,
            is_modifier: editorData.is_modifier,
            baseline_score: editorData.baseline_score,
            is_active: editorData.is_active,
          },
        });
      }
      setSaveSuccess(true);
      setTimeout(closeEditor, 500);
    } catch {
      // Error handled by mutation
    }
  };

  const deleteRubric = async () => {
    if (!editingRubric) return;
    if (!confirm(`Delete "${editingRubric.name}"? This cannot be undone.`)) return;

    try {
      await deleteMutation.mutateAsync(editingRubric.id);
      closeEditor();
    } catch {
      // Error handled by mutation
    }
  };

  const getPublicationName = (pubId: string) => {
    return publications.find((p) => p.id === pubId)?.name || pubId;
  };

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;
  const mutationError =
    createMutation.error || updateMutation.error || deleteMutation.error;

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
          {rubrics.length} rubrics •{" "}
          {rubrics.filter((r) => r.is_active).length} active
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rubric
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

      {Object.entries(rubricsByPublication).map(([pubId, pubRubrics]) => (
        <div key={pubId} className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5" />
            {getPublicationName(pubId)}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pubRubrics.map((rubric) => (
              <Card
                key={rubric.id}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${
                  !rubric.is_active ? "opacity-50" : ""
                }`}
                onClick={() => openEditor(rubric)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        <span className="truncate">{rubric.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        Weight: {rubric.weight} • Baseline: {rubric.baseline_score}
                      </CardDescription>
                    </div>
                    {rubric.is_modifier && (
                      <Badge variant="secondary" className="text-xs">
                        Modifier
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {rubric.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {rubric.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {rubric.criteria?.length || 0} criteria defined
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {rubrics.length === 0 && (
        <div className="text-center py-12">
          <Calculator className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No scoring rubrics configured.</p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Rubric
          </Button>
        </div>
      )}

      <Dialog
        open={!!editingRubric || isCreating}
        onOpenChange={(open) => !open && closeEditor()}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <Plus className="h-5 w-5" />
                  New Scoring Rubric
                </>
              ) : (
                <>
                  <Edit className="h-5 w-5" />
                  {editingRubric?.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Define scoring criteria for a publication."
                : `Configure scoring rubric for content evaluation.`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editorData.name || ""}
                    onChange={(e) =>
                      setEditorData({ ...editorData, name: e.target.value })
                    }
                    placeholder="Actionability"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={editorData.slug || ""}
                    onChange={(e) =>
                      setEditorData({ ...editorData, slug: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                    }
                    placeholder="actionability"
                    disabled={!isCreating}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Publication</Label>
                <Select
                  value={editorData.publication_slug || ""}
                  onValueChange={(v) =>
                    setEditorData({ ...editorData, publication_slug: v })
                  }
                  disabled={!isCreating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select publication" />
                  </SelectTrigger>
                  <SelectContent>
                    {publications.map((p) => (
                      <SelectItem key={p.id} value={p.slug}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editorData.description || ""}
                  onChange={(e) =>
                    setEditorData({ ...editorData, description: e.target.value })
                  }
                  placeholder="How actionable is this content?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weight</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    value={editorData.weight ?? 1.0}
                    onChange={(e) =>
                      setEditorData({ ...editorData, weight: parseFloat(e.target.value) || 1.0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Baseline Score</Label>
                  <Input
                    type="number"
                    step={0.5}
                    min={0}
                    max={10}
                    value={editorData.baseline_score ?? 5.0}
                    onChange={(e) =>
                      setEditorData({ ...editorData, baseline_score: parseFloat(e.target.value) || 5.0 })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editorData.is_modifier ?? false}
                  onCheckedChange={(checked) =>
                    setEditorData({ ...editorData, is_modifier: checked })
                  }
                />
                <Label>Is Modifier (applies after base scoring)</Label>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Criteria (JSON)</Label>
                <Textarea
                  value={criteriaJson}
                  onChange={(e) => setCriteriaJson(e.target.value)}
                  placeholder='[{ "score": 10, "description": "Excellent" }]'
                  className="min-h-[150px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Array of scoring criteria with score, description, and optional example fields.
                </p>
              </div>

              <Separator />

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

          <div className="flex justify-between">
            {editingRubric && (
              <Button variant="destructive" onClick={deleteRubric}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeEditor}>
                Cancel
              </Button>
              <Button onClick={saveRubric} disabled={isSaving}>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
