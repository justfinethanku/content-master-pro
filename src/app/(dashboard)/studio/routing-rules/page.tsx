"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
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
  Route,
  Edit,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  GripVertical,
  ArrowRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  useRoutingRules,
  usePublications,
  useCreateRoutingRule,
  useUpdateRoutingRule,
  useDeleteRoutingRule,
  useReorderRoutingRules,
} from "@/hooks/use-routing-config";
import type { RoutingRule, RoutingRuleInsert, RoutingDestination, YouTubeVersion } from "@/lib/types";

export default function RoutingRulesPage() {
  const { data: rules = [], isLoading, error } = useRoutingRules();
  // Publications fetch removed - rules use slugs directly
  usePublications(); // Keep query active for potential future use
  const createMutation = useCreateRoutingRule();
  const updateMutation = useUpdateRoutingRule();
  const deleteMutation = useDeleteRoutingRule();
  const reorderMutation = useReorderRoutingRules();

  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editorData, setEditorData] = useState<Partial<RoutingRuleInsert>>({});
  const [conditionsJson, setConditionsJson] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  const openEditor = (rule: RoutingRule) => {
    setEditingRule(rule);
    setIsCreating(false);
    setEditorData({
      name: rule.name,
      description: rule.description,
      routes_to: rule.routes_to,
      youtube_version: rule.youtube_version,
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setConditionsJson(JSON.stringify(rule.conditions, null, 2));
    setSaveSuccess(false);
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setIsCreating(true);
    setEditorData({
      name: "",
      description: "",
      routes_to: "core" as RoutingDestination,
      youtube_version: "no" as YouTubeVersion,
      priority: sortedRules.length,
      is_active: true,
    });
    setConditionsJson('{ "always": true }');
    setSaveSuccess(false);
  };

  const closeEditor = () => {
    setEditingRule(null);
    setIsCreating(false);
    setEditorData({});
    setConditionsJson("");
    setSaveSuccess(false);
  };

  const saveRule = async () => {
    try {
      let conditions;
      try {
        conditions = JSON.parse(conditionsJson);
      } catch {
        throw new Error("Invalid JSON in conditions field");
      }

      const dataToSave = {
        ...editorData,
        conditions,
      };

      if (isCreating) {
        await createMutation.mutateAsync(dataToSave as RoutingRuleInsert);
      } else if (editingRule) {
        await updateMutation.mutateAsync({
          id: editingRule.id,
          updates: dataToSave,
        });
      }
      setSaveSuccess(true);
      setTimeout(closeEditor, 500);
    } catch {
      // Error handled by mutation
    }
  };

  const deleteRule = async () => {
    if (!editingRule) return;
    if (!confirm(`Delete "${editingRule.name}"? This cannot be undone.`)) return;

    try {
      await deleteMutation.mutateAsync(editingRule.id);
      closeEditor();
    } catch {
      // Error handled by mutation
    }
  };

  const moveRule = async (ruleId: string, direction: "up" | "down") => {
    const currentIndex = sortedRules.findIndex((r) => r.id === ruleId);
    if (currentIndex < 0) return;

    const newIndex =
      direction === "up"
        ? Math.max(0, currentIndex - 1)
        : Math.min(sortedRules.length - 1, currentIndex + 1);

    if (currentIndex === newIndex) return;

    const newOrder = [...sortedRules];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(newIndex, 0, moved);

    try {
      await reorderMutation.mutateAsync(newOrder.map((r) => r.id));
    } catch {
      // Error handled by mutation
    }
  };

  const getConditionSummary = (conds: unknown): string => {
    if (!conds) return "No conditions";
    const c = conds as { always?: boolean; field?: string };
    if (c.always) return "Always matches";
    if (c.field) return `When ${c.field} matches...`;
    return "Custom conditions";
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
        <div>
          <p className="text-sm text-muted-foreground">
            {rules.length} rules • Priority order (first match wins)
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
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

      <div className="space-y-2">
        {sortedRules.map((rule, index) => (
          <Card
            key={rule.id}
            className={`transition-colors ${
              !rule.is_active ? "opacity-50" : ""
            }`}
          >
            <CardHeader className="py-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveRule(rule.id, "up")}
                    disabled={index === 0 || reorderMutation.isPending}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveRule(rule.id, "down")}
                    disabled={
                      index === sortedRules.length - 1 ||
                      reorderMutation.isPending
                    }
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                    {!rule.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-1 line-clamp-1">
                    {getConditionSummary(rule.conditions)}
                  </CardDescription>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {rule.routes_to}
                  </Badge>
                  {rule.youtube_version === "yes" && (
                    <Badge
                      variant="outline"
                      className="bg-red-500/10 text-red-600 border-red-500/20"
                    >
                      +YouTube
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditor(rule)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12">
          <Route className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No routing rules configured.</p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Rule
          </Button>
        </div>
      )}

      <Dialog
        open={!!editingRule || isCreating}
        onOpenChange={(open) => !open && closeEditor()}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <Plus className="h-5 w-5" />
                  New Routing Rule
                </>
              ) : (
                <>
                  <Edit className="h-5 w-5" />
                  {editingRule?.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Define conditions to route ideas to specific publications."
                : `Edit routing rule conditions and destination.`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-6 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input
                    value={editorData.name || ""}
                    onChange={(e) =>
                      setEditorData({ ...editorData, name: e.target.value })
                    }
                    placeholder="Deep Technical Content"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editorData.priority ?? 0}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        priority: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editorData.description || ""}
                  onChange={(e) =>
                    setEditorData({ ...editorData, description: e.target.value })
                  }
                  placeholder="Routes deep technical content to Core..."
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Destination</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Routes To</Label>
                    <Select
                      value={editorData.routes_to || "core"}
                      onValueChange={(v) =>
                        setEditorData({ ...editorData, routes_to: v as RoutingDestination })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">Core</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>YouTube Version</Label>
                    <Select
                      value={editorData.youtube_version || "no"}
                      onValueChange={(v) =>
                        setEditorData({ ...editorData, youtube_version: v as YouTubeVersion })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="tbd">TBD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Conditions (JSON)</Label>
                <Textarea
                  value={conditionsJson}
                  onChange={(e) => setConditionsJson(e.target.value)}
                  placeholder='{ "always": true }'
                  className="min-h-[150px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Define routing conditions. Use {"{ \"always\": true }"} to always match,
                  or specify field/op/value conditions.
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
            {editingRule && (
              <Button variant="destructive" onClick={deleteRule}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeEditor}>
                Cancel
              </Button>
              <Button onClick={saveRule} disabled={isSaving}>
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
