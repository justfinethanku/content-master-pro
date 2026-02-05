"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Layers,
  Edit,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Star,
  Award,
  Trophy,
  Medal,
  XCircle,
} from "lucide-react";
import {
  useTierThresholds,
  useUpdateTierThreshold,
} from "@/hooks/use-routing-config";
import type { TierThreshold, TierThresholdUpdate } from "@/lib/types";

const TIER_ICONS: Record<string, React.ElementType> = {
  premium_a: Trophy,
  a: Award,
  b: Medal,
  c: Star,
  kill: XCircle,
};

const TIER_COLORS: Record<string, string> = {
  premium_a: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  a: "bg-green-500/10 text-green-600 border-green-500/20",
  b: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  c: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  kill: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function TiersPage() {
  const { data: tiers = [], isLoading, error } = useTierThresholds();
  const updateMutation = useUpdateTierThreshold();

  const [editingTier, setEditingTier] = useState<TierThreshold | null>(null);
  const [editorData, setEditorData] = useState<Partial<TierThresholdUpdate>>({});
  const [actionsJson, setActionsJson] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sort tiers by min_score descending
  const sortedTiers = [...tiers].sort((a, b) => (b.min_score ?? 0) - (a.min_score ?? 0));

  const openEditor = (tier: TierThreshold) => {
    setEditingTier(tier);
    setEditorData({
      display_name: tier.display_name,
      description: tier.description,
      min_score: tier.min_score,
      max_score: tier.max_score,
      auto_stagger: tier.auto_stagger,
    });
    setActionsJson(JSON.stringify(tier.actions || {}, null, 2));
    setSaveSuccess(false);
  };

  const closeEditor = () => {
    setEditingTier(null);
    setEditorData({});
    setActionsJson("");
    setSaveSuccess(false);
  };

  const saveTier = async () => {
    if (!editingTier) return;

    try {
      let actions;
      try {
        actions = JSON.parse(actionsJson);
      } catch {
        throw new Error("Invalid JSON in actions field");
      }

      await updateMutation.mutateAsync({
        id: editingTier.id,
        updates: {
          ...editorData,
          actions,
        },
      });
      setSaveSuccess(true);
      setTimeout(closeEditor, 500);
    } catch {
      // Error handled by mutation
    }
  };

  const getTierIcon = (tier: string) => {
    const Icon = TIER_ICONS[tier.toLowerCase()] || Layers;
    return <Icon className="h-5 w-5" />;
  };

  const getTierColor = (tier: string) => {
    return TIER_COLORS[tier.toLowerCase()] || "bg-muted text-muted-foreground";
  };

  const formatScoreRange = (tier: TierThreshold) => {
    if (tier.min_score === undefined && tier.max_score === undefined) return "Any score";
    if (tier.max_score === undefined) return `≥ ${tier.min_score?.toFixed(1)}`;
    if (tier.min_score === undefined) return `≤ ${tier.max_score?.toFixed(1)}`;
    return `${tier.min_score?.toFixed(1)} – ${tier.max_score?.toFixed(1)}`;
  };

  const isSaving = updateMutation.isPending;
  const mutationError = updateMutation.error;

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
          {tiers.length} tier thresholds
        </p>
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
        {sortedTiers.map((tier) => (
          <Card
            key={tier.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => openEditor(tier)}
          >
            <CardHeader className="py-3">
              <div className="flex items-center gap-4">
                <Badge
                  variant="outline"
                  className={`${getTierColor(tier.tier)} px-3 py-1`}
                >
                  {getTierIcon(tier.tier)}
                  <span className="ml-2 font-semibold uppercase">
                    {tier.display_name}
                  </span>
                </Badge>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      {formatScoreRange(tier)}
                    </span>
                    {tier.auto_stagger && (
                      <Badge variant="secondary" className="text-xs">
                        Auto-stagger
                      </Badge>
                    )}
                  </div>
                  {tier.description && (
                    <CardDescription className="text-xs mt-1">
                      {tier.description}
                    </CardDescription>
                  )}
                </div>
                <Edit className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {tiers.length === 0 && (
        <div className="text-center py-12">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No tier thresholds configured.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Run database migrations to seed default tiers.
          </p>
        </div>
      )}

      <Dialog open={!!editingTier} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Tier: {editingTier?.display_name}
            </DialogTitle>
            <DialogDescription>
              Configure score thresholds and behaviors for this tier.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={editorData.display_name || ""}
                  onChange={(e) =>
                    setEditorData({ ...editorData, display_name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Score</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    value={editorData.min_score ?? ""}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        min_score: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="No minimum"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum Score</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    value={editorData.max_score ?? ""}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        max_score: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="No maximum"
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
                  placeholder="Premium content requiring strategic scheduling..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editorData.auto_stagger ?? false}
                  onCheckedChange={(checked) =>
                    setEditorData({ ...editorData, auto_stagger: checked })
                  }
                />
                <Label>Auto-stagger scheduling</Label>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Actions (JSON)</Label>
                <Textarea
                  value={actionsJson}
                  onChange={(e) => setActionsJson(e.target.value)}
                  placeholder='{ "notify": true, "highlight": true }'
                  className="min-h-[100px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Custom actions for this tier: notify, highlight, require_review, etc.
                </p>
              </div>
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button onClick={saveTier} disabled={isSaving}>
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
