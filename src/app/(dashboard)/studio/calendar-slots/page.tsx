"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  CalendarClock,
  Edit,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
} from "lucide-react";
import {
  useCalendarSlots,
  usePublications,
  useCreateCalendarSlot,
  useUpdateCalendarSlot,
  useDeleteCalendarSlot,
} from "@/hooks/use-routing-config";
import type { CalendarSlot, CalendarSlotInsert } from "@/lib/types";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIERS = [
  { value: "premium_a", label: "Premium A" },
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

export default function CalendarSlotsPage() {
  const { data: slots = [], isLoading, error } = useCalendarSlots();
  const { data: publications = [] } = usePublications();
  const createMutation = useCreateCalendarSlot();
  const updateMutation = useUpdateCalendarSlot();
  const deleteMutation = useDeleteCalendarSlot();

  // Editor state
  const [editingSlot, setEditingSlot] = useState<CalendarSlot | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editorData, setEditorData] = useState<Partial<CalendarSlotInsert> & { publication_slug?: string }>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Group slots by publication
  const slotsByPublication = slots.reduce(
    (acc, slot) => {
      const pub = slot.publication_id || "unknown";
      if (!acc[pub]) acc[pub] = [];
      acc[pub].push(slot);
      return acc;
    },
    {} as Record<string, CalendarSlot[]>
  );

  // Sort slots by day_of_week within each publication
  Object.keys(slotsByPublication).forEach((pub) => {
    slotsByPublication[pub].sort((a, b) => a.day_of_week - b.day_of_week);
  });

  const openEditor = (slot: CalendarSlot) => {
    setEditingSlot(slot);
    setIsCreating(false);
    // Find publication slug from ID
    const pub = publications.find(p => p.id === slot.publication_id);
    setEditorData({
      publication_id: slot.publication_id,
      publication_slug: pub?.slug,
      day_of_week: slot.day_of_week,
      is_fixed: slot.is_fixed,
      fixed_format: slot.fixed_format,
      fixed_format_name: slot.fixed_format_name,
      preferred_tier: slot.preferred_tier,
      tier_priority: slot.tier_priority,
      is_active: slot.is_active,
    });
    setSaveSuccess(false);
  };

  const openCreateDialog = () => {
    setEditingSlot(null);
    setIsCreating(true);
    setEditorData({
      publication_slug: publications[0]?.slug || "",
      day_of_week: 1,
      is_fixed: false,
      tier_priority: 1,
      is_active: true,
    });
    setSaveSuccess(false);
  };

  const closeEditor = () => {
    setEditingSlot(null);
    setIsCreating(false);
    setEditorData({});
    setSaveSuccess(false);
  };

  const saveSlot = async () => {
    try {
      if (isCreating) {
        // Find publication ID from slug
        const pub = publications.find(p => p.slug === editorData.publication_slug);
        if (!pub) throw new Error("Publication not found");
        
        const insertData = {
          publication_id: pub.id,
          publication_slug: editorData.publication_slug!,
          day_of_week: editorData.day_of_week!,
          is_fixed: editorData.is_fixed,
          fixed_format: editorData.fixed_format,
          fixed_format_name: editorData.fixed_format_name,
          preferred_tier: editorData.preferred_tier,
          tier_priority: editorData.tier_priority,
          is_active: editorData.is_active,
        };
        await createMutation.mutateAsync(insertData as CalendarSlotInsert & { publication_slug: string });
      } else if (editingSlot) {
        await updateMutation.mutateAsync({
          id: editingSlot.id,
          updates: {
            day_of_week: editorData.day_of_week,
            is_fixed: editorData.is_fixed,
            fixed_format: editorData.fixed_format,
            fixed_format_name: editorData.fixed_format_name,
            preferred_tier: editorData.preferred_tier,
            tier_priority: editorData.tier_priority,
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

  const deleteSlot = async () => {
    if (!editingSlot) return;
    if (!confirm("Delete this slot? This cannot be undone.")) return;

    try {
      await deleteMutation.mutateAsync(editingSlot.id);
      closeEditor();
    } catch {
      // Error handled by mutation
    }
  };

  const getPublicationName = (pubId: string) => {
    return publications.find((p) => p.id === pubId)?.name || pubId;
  };

  const getDayName = (day: number) => {
    return DAYS_OF_WEEK.find((d) => d.value === day)?.label || `Day ${day}`;
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
          {slots.length} slots • {slots.filter((s) => s.is_active).length} active
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Slot
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

      {Object.entries(slotsByPublication).map(([pubId, pubSlots]) => (
        <div key={pubId} className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            {getPublicationName(pubId)}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pubSlots.map((slot) => (
              <Card
                key={slot.id}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${
                  !slot.is_active ? "opacity-50" : ""
                }`}
                onClick={() => openEditor(slot)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {getDayName(slot.day_of_week)}
                    </CardTitle>
                    {slot.is_fixed && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                        <Lock className="h-3 w-3 mr-1" />
                        Fixed
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {slot.preferred_tier && (
                      <p>Preferred: {slot.preferred_tier.toUpperCase()}</p>
                    )}
                    {slot.fixed_format_name && (
                      <p>Format: {slot.fixed_format_name}</p>
                    )}
                    <p>Priority: {slot.tier_priority}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {slots.length === 0 && (
        <div className="text-center py-12">
          <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No calendar slots configured.</p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Slot
          </Button>
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog
        open={!!editingSlot || isCreating}
        onOpenChange={(open) => !open && closeEditor()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <Plus className="h-5 w-5" />
                  New Calendar Slot
                </>
              ) : (
                <>
                  <Edit className="h-5 w-5" />
                  Edit Slot
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Add a recurring calendar slot for a publication."
                : "Configure this calendar slot."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
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
                <Label>Day of Week</Label>
                <Select
                  value={String(editorData.day_of_week ?? 1)}
                  onValueChange={(v) =>
                    setEditorData({ ...editorData, day_of_week: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editorData.is_fixed ?? false}
                  onCheckedChange={(checked) =>
                    setEditorData({ ...editorData, is_fixed: checked })
                  }
                />
                <Label>Fixed Slot</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Fixed slots are reserved for specific content formats
              </p>

              {editorData.is_fixed && (
                <>
                  <div className="space-y-2">
                    <Label>Fixed Format</Label>
                    <Input
                      value={editorData.fixed_format || ""}
                      onChange={(e) =>
                        setEditorData({ ...editorData, fixed_format: e.target.value })
                      }
                      placeholder="e.g., deep_dive"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Format Name</Label>
                    <Input
                      value={editorData.fixed_format_name || ""}
                      onChange={(e) =>
                        setEditorData({ ...editorData, fixed_format_name: e.target.value })
                      }
                      placeholder="e.g., Deep Dive Thursday"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Preferred Tier</Label>
                <Select
                  value={editorData.preferred_tier || "none"}
                  onValueChange={(v) =>
                    setEditorData({ ...editorData, preferred_tier: v === "none" ? undefined : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any tier</SelectItem>
                    {TIERS.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>
                        {tier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tier Priority</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={editorData.tier_priority ?? 1}
                  onChange={(e) =>
                    setEditorData({ ...editorData, tier_priority: parseInt(e.target.value) || 1 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority slots are filled first
                </p>
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

          <div className="flex justify-between">
            {editingSlot && (
              <Button variant="destructive" onClick={deleteSlot}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeEditor}>
                Cancel
              </Button>
              <Button onClick={saveSlot} disabled={isSaving}>
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
