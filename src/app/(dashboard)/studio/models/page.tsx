"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Cpu,
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
  Calendar,
  DollarSign,
  Eye,
  Brain,
  Wrench,
  FileInput,
  Sparkles,
  Database,
  Star,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ImagePlus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PricingData {
  input?: string;
  output?: string;
  image?: string;
  web_search?: string;
  cache_creation_input?: string;
  cache_read_input?: string;
  [key: string]: unknown;
}

interface AIModel {
  id: string;
  model_id: string;
  provider: string;
  display_name: string;
  description: string | null;
  model_type: string;
  context_window: number | null;
  max_output_tokens: number | null;
  is_available: boolean;
  supports_streaming: boolean;
  supports_images: boolean;
  supports_thinking: boolean;
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
  pricing: PricingData | null;
  tags: string[] | null;
  released_at: string | null;
  gateway_type: string | null;
}

interface SyncReport {
  success: boolean;
  totalFromApi: number;
  excluded: number;
  synced: number;
  newModels: number;
  updatedModels: number;
}

/**
 * Derive a model family key by stripping version-like suffixes.
 * e.g. "anthropic/claude-sonnet-4-5" → "anthropic/claude-sonnet"
 *      "openai/gpt-4.1" → "openai/gpt"
 *      "google/gemini-2.5-flash" → "google/gemini-flash"
 */
function getModelFamily(modelId: string): string {
  const slashIdx = modelId.indexOf("/");
  const provider = slashIdx >= 0 ? modelId.slice(0, slashIdx) : modelId;
  const name = slashIdx >= 0 ? modelId.slice(slashIdx + 1) : modelId;
  // Strip trailing version segments: numbers, dots, dashes followed by numbers
  const family = name.replace(/[-.]?\d[\d.]*(-\d[\d.]*)*$/g, "").replace(/-$/, "");
  return `${provider}/${family || name}`;
}

export default function ModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);

  // Collapsible provider group state (persisted in localStorage, loaded after hydration)
  const [pinnedProviders, setPinnedProviders] = useState<Set<string>>(new Set());
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [showLatestOnly, setShowLatestOnly] = useState(false);

  // Load from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const pinned = localStorage.getItem("cmp:models:pinned");
      if (pinned) setPinnedProviders(new Set(JSON.parse(pinned) as string[]));
      const expanded = localStorage.getItem("cmp:models:expanded");
      if (expanded) setExpandedProviders(new Set(JSON.parse(expanded) as string[]));
      // Restore filter state
      const filters = localStorage.getItem("cmp:models:filters");
      if (filters) {
        const f = JSON.parse(filters) as { type?: string; enabledOnly?: boolean; latestOnly?: boolean };
        if (f.type) setFilterType(f.type);
        if (f.enabledOnly) setShowEnabledOnly(true);
        if (f.latestOnly) setShowLatestOnly(true);
      }
    } catch { /* ignore corrupt localStorage */ }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change (only after initial hydration)
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem("cmp:models:pinned", JSON.stringify([...pinnedProviders]));
  }, [pinnedProviders, isHydrated]);
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem("cmp:models:expanded", JSON.stringify([...expandedProviders]));
  }, [expandedProviders, isHydrated]);
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem("cmp:models:filters", JSON.stringify({
      type: filterType,
      enabledOnly: showEnabledOnly,
      latestOnly: showLatestOnly,
    }));
  }, [filterType, showEnabledOnly, showLatestOnly, isHydrated]);

  const togglePin = (provider: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  const toggleExpanded = (provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

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
    setSyncReport(null);

    try {
      const response = await fetch("/api/admin/sync-models", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync models");
      }

      const report = (await response.json()) as SyncReport;
      setSyncReport(report);
      await loadModels();
    } catch (err) {
      console.error("Failed to sync models:", err);
      setError(err instanceof Error ? err.message : "Failed to sync models");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleAvailability = async (model: AIModel, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !model.is_available;

    // Optimistic update
    setModels((prev) =>
      prev.map((m) =>
        m.id === model.id ? { ...m, is_available: newValue } : m
      )
    );

    try {
      const { error: updateError } = await supabase
        .from("ai_models")
        .update({ is_available: newValue })
        .eq("id", model.id);

      if (updateError) throw updateError;
    } catch (err) {
      // Revert on failure
      setModels((prev) =>
        prev.map((m) =>
          m.id === model.id ? { ...m, is_available: !newValue } : m
        )
      );
      console.error("Failed to toggle availability:", err);
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
      // Build update payload — include image_config only if model is image type
      const updatePayload: Record<string, unknown> = {
        system_prompt_tips: editorData.system_prompt_tips,
        preferred_format: editorData.preferred_format,
        format_instructions: editorData.format_instructions,
        quirks: editorData.quirks,
        default_temperature: editorData.default_temperature,
        default_max_tokens: editorData.default_max_tokens,
        api_notes: editorData.api_notes,
        model_type: editorData.model_type,
      };

      if ((editorData.model_type || editingModel.model_type) === "image" && editorData.image_config) {
        updatePayload.image_config = editorData.image_config;
      }

      const { error: updateError } = await supabase
        .from("ai_models")
        .update(updatePayload)
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
        return <MessageSquare className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      case "research":
        return <Search className="h-4 w-4" />;
      default:
        return <Cpu className="h-4 w-4" />;
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

  const getTagIcon = (tag: string) => {
    switch (tag) {
      case "reasoning":
        return <Brain className="h-3 w-3" />;
      case "vision":
        return <Eye className="h-3 w-3" />;
      case "tool-use":
        return <Wrench className="h-3 w-3" />;
      case "file-input":
        return <FileInput className="h-3 w-3" />;
      case "image-generation":
        return <Sparkles className="h-3 w-3" />;
      case "implicit-caching":
        return <Database className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const formatNumber = (num: number | null): string => {
    if (num === null) return "N/A";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toString();
  };

  /** Format per-token pricing string to human-readable per-million format */
  const formatPricing = (pricing: PricingData | null): string | null => {
    if (!pricing) return null;

    const parts: string[] = [];

    if (pricing.input && pricing.output) {
      const inputPerM = parseFloat(pricing.input as string) * 1_000_000;
      const outputPerM = parseFloat(pricing.output as string) * 1_000_000;
      if (!isNaN(inputPerM) && !isNaN(outputPerM)) {
        parts.push(`$${formatPrice(inputPerM)} in / $${formatPrice(outputPerM)} out`);
      }
    }

    if (pricing.image) {
      const imagePrice = parseFloat(pricing.image as string);
      if (!isNaN(imagePrice)) {
        parts.push(`$${formatPrice(imagePrice)}/image`);
      }
    }

    if (pricing.web_search) {
      const searchPrice = parseFloat(pricing.web_search as string);
      if (!isNaN(searchPrice)) {
        parts.push(`$${formatPrice(searchPrice)}/search`);
      }
    }

    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const formatPrice = (price: number): string => {
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(3);
    return price.toFixed(4);
  };

  const formatDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  // Type counts (computed from all models, not filtered)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of models) {
      counts[m.model_type] = (counts[m.model_type] || 0) + 1;
    }
    return counts;
  }, [models]);

  // Filtered models pipeline
  const filteredModels = useMemo(() => {
    let result = models;

    if (filterType) {
      result = result.filter((m) => m.model_type === filterType);
    }

    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      result = result.filter(
        (m) =>
          m.display_name.toLowerCase().includes(q) ||
          m.model_id.toLowerCase().includes(q)
      );
    }

    if (showEnabledOnly) {
      result = result.filter((m) => m.is_available);
    }

    if (showLatestOnly) {
      const familyMap = new Map<string, AIModel>();
      for (const m of result) {
        const family = getModelFamily(m.model_id);
        const existing = familyMap.get(family);
        if (
          !existing ||
          (m.released_at && (!existing.released_at || m.released_at > existing.released_at))
        ) {
          familyMap.set(family, m);
        }
      }
      result = Array.from(familyMap.values());
    }

    return result;
  }, [models, filterType, filterSearch, showEnabledOnly, showLatestOnly]);

  const hasActiveFilters = filterType !== null || filterSearch.trim() !== "" || showEnabledOnly || showLatestOnly;

  const clearFilters = () => {
    setFilterType(null);
    setFilterSearch("");
    setShowEnabledOnly(false);
    setShowLatestOnly(false);
  };

  // Group filtered models by provider, sorted by release date within each group
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, AIModel[]> = {};
    for (const model of filteredModels) {
      if (!groups[model.provider]) groups[model.provider] = [];
      groups[model.provider].push(model);
    }
    // Sort within each group: newest first, null dates last
    for (const providerModels of Object.values(groups)) {
      providerModels.sort((a, b) => {
        if (!a.released_at && !b.released_at) return a.display_name.localeCompare(b.display_name);
        if (!a.released_at) return 1;
        if (!b.released_at) return -1;
        return b.released_at.localeCompare(a.released_at);
      });
    }
    return groups;
  }, [filteredModels]);

  // Sorted provider list: pinned first (alpha), then unpinned (alpha)
  const sortedProviders = useMemo(() => {
    return Object.keys(modelsByProvider).sort((a, b) => {
      const aPinned = pinnedProviders.has(a);
      const bPinned = pinnedProviders.has(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return a.localeCompare(b);
    });
  }, [modelsByProvider, pinnedProviders]);

  const allExpanded = sortedProviders.length > 0 && sortedProviders.every((p) => expandedProviders.has(p));

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedProviders(new Set());
    } else {
      setExpandedProviders(new Set(sortedProviders));
    }
  };

  const availableCount = filteredModels.filter((m) => m.is_available).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row: stats + actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {hasActiveFilters ? (
            <>{filteredModels.length} of {models.length} models</>
          ) : (
            <>{models.length} models synced</>
          )}
          {" · "}{availableCount} enabled · {sortedProviders.length} provider{sortedProviders.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleAllExpanded} disabled={sortedProviders.length === 0}>
            <ChevronsUpDown className="mr-1.5 h-4 w-4" />
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
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
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        {/* Type toggles */}
        <div className="flex items-center gap-1.5">
          {(["text", "image", "research"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(filterType === type ? null : type)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filterType === type
                  ? type === "text"
                    ? "bg-blue-500/20 text-blue-600 ring-1 ring-blue-500/30"
                    : type === "image"
                      ? "bg-orange-500/20 text-orange-600 ring-1 ring-orange-500/30"
                      : "bg-purple-500/20 text-purple-600 ring-1 ring-purple-500/30"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {type === "text" ? <MessageSquare className="h-3 w-3" /> : type === "image" ? <Image className="h-3 w-3" /> : <Search className="h-3 w-3" />}
              {type.charAt(0).toUpperCase() + type.slice(1)}
              <span className="text-[10px] opacity-60">({typeCounts[type] || 0})</span>
            </button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Search */}
        <div className="relative flex-1 min-w-40 max-w-65">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search models..."
            className="h-8 pl-8 pr-8 text-xs"
          />
          {filterSearch && (
            <button
              type="button"
              onClick={() => setFilterSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Checkboxes */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={showEnabledOnly}
              onCheckedChange={(c) => setShowEnabledOnly(!!c)}
              className="h-3.5 w-3.5"
            />
            <span className="text-muted-foreground">Enabled only</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={showLatestOnly}
              onCheckedChange={(c) => setShowLatestOnly(!!c)}
              className="h-3.5 w-3.5"
            />
            <span className="text-muted-foreground">Latest only</span>
          </label>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs">
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </>
        )}
      </div>

      {syncReport && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <Check className="h-4 w-4" />
            Synced {syncReport.synced} models ({syncReport.newModels} new,{" "}
            {syncReport.updatedModels} updated, {syncReport.excluded} embedding
            excluded)
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {sortedProviders.map((provider) => {
        const providerModels = modelsByProvider[provider];
        const enabledCount = providerModels.filter((m) => m.is_available).length;
        const isPinned = pinnedProviders.has(provider);
        const isExpanded = expandedProviders.has(provider);

        return (
          <Collapsible
            key={provider}
            open={isExpanded}
            onOpenChange={() => toggleExpanded(provider)}
          >
            <div className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <button
                type="button"
                onClick={(e) => togglePin(provider, e)}
                className="shrink-0 text-muted-foreground hover:text-yellow-500 transition-colors"
                aria-label={isPinned ? `Unpin ${provider}` : `Pin ${provider}`}
              >
                <Star
                  className={`h-4 w-4 ${isPinned ? "fill-yellow-500 text-yellow-500" : ""}`}
                />
              </button>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left transition-colors hover:text-foreground"
                >
                  <span className="text-base font-semibold capitalize flex-1">
                    {provider}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {providerModels.length} model{providerModels.length !== 1 ? "s" : ""}
                    {enabledCount > 0 && (
                      <span className="ml-1.5 text-primary">
                        · {enabledCount} enabled
                      </span>
                    )}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pt-3">
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
                            <span className="truncate">
                              {model.display_name}
                            </span>
                          </CardTitle>
                          <CardDescription className="mt-1 text-xs truncate">
                            {model.model_id}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={getTypeColor(model.model_type)}
                          >
                            {model.model_type.toUpperCase()}
                          </Badge>
                          <div onClick={(e) => toggleAvailability(model, e)}>
                            <Switch
                              checked={model.is_available}
                              aria-label={`Toggle ${model.display_name} availability`}
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 overflow-hidden">
                      {/* Description */}
                      {model.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {model.description}
                        </p>
                      )}

                      {/* Pricing */}
                      {formatPricing(model.pricing) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                          <DollarSign className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {formatPricing(model.pricing)}
                          </span>
                        </div>
                      )}

                      {/* Tags + image capabilities */}
                      {(model.tags?.length || (model.model_type === "image" && model.image_config)) && (
                        <div className="flex flex-wrap gap-1">
                          {model.tags?.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5 gap-1"
                            >
                              {getTagIcon(tag)}
                              {tag}
                            </Badge>
                          ))}
                          {model.model_type === "image" && !!(model.image_config as Record<string, unknown>)?.supports_image_input && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-green-500/10 text-green-600 border-green-500/20"
                            >
                              <ImagePlus className="h-2.5 w-2.5" />
                              Ref Image
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Specs row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 min-w-0 overflow-hidden">
                        {model.context_window && (
                          <span>{formatNumber(model.context_window)} ctx</span>
                        )}
                        {model.max_output_tokens && (
                          <span>
                            {formatNumber(model.max_output_tokens)} out
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          {model.supports_streaming && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1"
                            >
                              <Zap className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                          {formatDate(model.released_at) && (
                            <span className="flex items-center gap-1 text-[10px]">
                              <Calendar className="h-2.5 w-2.5" />
                              {formatDate(model.released_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Manual config indicator */}
                      {model.system_prompt_tips && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Info className="h-3 w-3" />
                          <span className="truncate">Has prompting tips</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Empty state when all models are filtered out */}
      {sortedProviders.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No models match your filters</p>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
            Clear filters
          </Button>
        </div>
      )}

      {/* Editor Dialog — manual fields only */}
      <Dialog
        open={!!editingModel}
        onOpenChange={(open) => !open && closeEditor()}
      >
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
              {/* Read-only info summary */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Provider
                  </Label>
                  <p className="font-medium capitalize">
                    {editingModel?.provider}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Gateway Type
                  </Label>
                  <p className="font-medium">
                    {editingModel?.gateway_type || "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Context Window
                  </Label>
                  <p className="font-medium">
                    {formatNumber(editingModel?.context_window || null)} tokens
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Max Output
                  </Label>
                  <p className="font-medium">
                    {formatNumber(editingModel?.max_output_tokens || null)}{" "}
                    tokens
                  </p>
                </div>
                <div className="col-span-2 flex flex-wrap gap-2">
                  {editingModel?.supports_streaming && (
                    <Badge variant="default">Streaming</Badge>
                  )}
                  {editingModel?.supports_images && (
                    <Badge variant="default">Images</Badge>
                  )}
                  {editingModel?.supports_thinking && (
                    <Badge variant="default">Reasoning</Badge>
                  )}
                  {!editingModel?.supports_streaming && (
                    <Badge variant="secondary">No Streaming</Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Model Type Override */}
              <div className="space-y-2">
                <Label>Model Type</Label>
                <Select
                  value={editorData.model_type || "text"}
                  onValueChange={(v) =>
                    setEditorData({ ...editorData, model_type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Override the auto-inferred type if needed
                </p>
              </div>

              {/* Image-specific settings (only for image models) */}
              {(editorData.model_type || editingModel?.model_type) === "image" && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-medium">Image Capabilities</h3>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="supports_image_input"
                        checked={
                          (editorData.image_config as Record<string, unknown>)?.supports_image_input === true
                        }
                        onCheckedChange={(checked) =>
                          setEditorData({
                            ...editorData,
                            image_config: {
                              ...(editorData.image_config as Record<string, unknown> || {}),
                              supports_image_input: !!checked,
                            },
                          })
                        }
                      />
                      <Label htmlFor="supports_image_input" className="text-sm font-normal cursor-pointer">
                        Supports reference image input
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this if the model can accept a reference image alongside the prompt
                      (e.g. for style transfer or composition guidance). This controls the reference
                      image upload on the Thumbnails page.
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Prompting Guidance */}
              <div className="space-y-4">
                <h3 className="font-medium">Prompting Guidance</h3>

                <div className="space-y-2">
                  <Label>System Prompt Tips</Label>
                  <Textarea
                    value={editorData.system_prompt_tips || ""}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        system_prompt_tips: e.target.value,
                      })
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
                          default_temperature: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
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
                      setEditorData({
                        ...editorData,
                        format_instructions: e.target.value,
                      })
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
                        default_max_tokens: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                    placeholder="4096"
                  />
                </div>
              </div>

              <Separator />

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
