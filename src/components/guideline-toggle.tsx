"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { createClient } from "@/lib/supabase/client";
import type { BrandGuideline } from "@/lib/supabase/guidelines";

interface GuidelineToggleProps {
  /** The prompt set ID to load defaults for */
  promptSetId?: string;
  /** Categories to show (e.g., ['image', 'voice']). If not provided, shows all. */
  categories?: string[];
  /** Called when guideline selection changes */
  onChange?: (overrides: Record<string, boolean>) => void;
  /** Optional className for the container */
  className?: string;
}

interface GuidelineState {
  guideline: BrandGuideline;
  isEnabled: boolean;
  isDefault: boolean;
}

export function GuidelineToggle({
  promptSetId,
  categories,
  onChange,
  className = "",
}: GuidelineToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [guidelines, setGuidelines] = useState<
    Record<string, GuidelineState[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);

  // Load guidelines and defaults
  useEffect(() => {
    async function loadGuidelines() {
      setIsLoading(true);
      try {
        const supabase = createClient();

        // Load all user guidelines
        const { data: guidelinesData, error: guidelinesError } = await supabase
          .from("brand_guidelines")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (guidelinesError) {
          console.error("Failed to load guidelines:", guidelinesError);
          return;
        }

        // Load defaults if promptSetId provided
        let defaultIds = new Set<string>();
        if (promptSetId) {
          const { data: defaults, error: defaultsError } = await supabase
            .from("prompt_guidelines")
            .select("guideline_id")
            .eq("prompt_set_id", promptSetId)
            .eq("is_default", true);

          if (!defaultsError && defaults) {
            defaultIds = new Set(defaults.map((d) => d.guideline_id));
          }
        }

        // Group by category with state
        const grouped: Record<string, GuidelineState[]> = {};
        for (const guideline of guidelinesData || []) {
          // Filter by categories if provided
          if (categories && !categories.includes(guideline.category)) {
            continue;
          }

          if (!grouped[guideline.category]) {
            grouped[guideline.category] = [];
          }

          // If no defaults set, enable all by default
          const isDefault =
            defaultIds.size > 0 ? defaultIds.has(guideline.id) : true;

          grouped[guideline.category].push({
            guideline,
            isEnabled: isDefault,
            isDefault,
          });
        }

        setGuidelines(grouped);
      } catch (error) {
        console.error("Error loading guidelines:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadGuidelines();
  }, [promptSetId, categories]);

  // Handle checkbox change
  const handleToggle = useCallback(
    (guidelineId: string, enabled: boolean) => {
      setGuidelines((prev) => {
        const updated = { ...prev };
        for (const category of Object.keys(updated)) {
          updated[category] = updated[category].map((state) =>
            state.guideline.id === guidelineId
              ? { ...state, isEnabled: enabled }
              : state
          );
        }

        // Build overrides and call onChange
        if (onChange) {
          const overrides: Record<string, boolean> = {};
          for (const category of Object.keys(updated)) {
            for (const state of updated[category]) {
              // Only include if different from default
              if (state.isEnabled !== state.isDefault) {
                overrides[state.guideline.id] = state.isEnabled;
              }
            }
          }
          onChange(overrides);
        }

        return updated;
      });
    },
    [onChange]
  );

  // Count active guidelines
  const activeCount = Object.values(guidelines)
    .flat()
    .filter((s) => s.isEnabled).length;
  const totalCount = Object.values(guidelines).flat().length;

  // Category display names
  const categoryNames: Record<string, string> = {
    image: "Image Guidelines",
    voice: "Voice Guidelines",
    tone: "Tone Guidelines",
  };

  if (isLoading) {
    return (
      <div className={`rounded-lg border bg-card p-3 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Settings2 className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Loading guidelines...</span>
        </div>
      </div>
    );
  }

  if (totalCount === 0) {
    return null; // No guidelines to show
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 hover:bg-accent/50 transition-colors rounded-lg">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Brand Guidelines</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {activeCount} / {totalCount} active
          </Badge>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-3 py-3 space-y-4">
            {Object.entries(guidelines).map(([category, states]) => (
              <div key={category} className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {categoryNames[category] || `${category} Guidelines`}
                </h4>
                <div className="space-y-2">
                  {states.map((state) => (
                    <div
                      key={state.guideline.id}
                      className="flex items-start gap-2"
                    >
                      <Checkbox
                        id={state.guideline.id}
                        checked={state.isEnabled}
                        onCheckedChange={(checked) =>
                          handleToggle(state.guideline.id, checked === true)
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={state.guideline.id}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {state.guideline.name}
                        </Label>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {state.guideline.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Hook to manage guideline overrides state
 */
export function useGuidelineOverrides() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const handleChange = useCallback((newOverrides: Record<string, boolean>) => {
    setOverrides(newOverrides);
  }, []);

  return {
    overrides,
    hasOverrides: Object.keys(overrides).length > 0,
    handleChange,
    reset: () => setOverrides({}),
  };
}
