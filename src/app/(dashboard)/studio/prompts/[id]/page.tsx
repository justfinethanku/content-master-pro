"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Save,
  Loader2,
  Check,
  AlertCircle,
  GripVertical,
  ChevronDown,
  ChevronRight,
  History,
  Archive,
  RotateCcw,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { createClient } from "@/lib/supabase/client";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, DragStartEvent } from "@dnd-kit/core";

interface PromptSet {
  id: string;
  slug: string;
  name: string;
  prompt_type: string;
  description: string | null;
  current_version_id: string | null;
  pipeline_stage: string | null;
}

interface PromptVariable {
  id: string;
  variable_name: string;
  display_name: string;
  description: string | null;
  category: string;
  creator: "user" | "ai" | "system";
  available_after_stage: string;
  fallback_value: string | null;
}

interface PromptVersion {
  id: string;
  prompt_set_id: string;
  version: number;
  prompt_content: string;
  model_id: string | null;
  api_config: {
    temperature?: number;
    max_tokens?: number;
    reasoning_enabled?: boolean;
    reasoning_budget?: number;
  };
  status: "draft" | "active" | "archived";
  created_at: string;
}

interface AIModel {
  id: string;
  model_id: string;
  provider: string;
  display_name: string;
  supports_thinking: boolean;
}

// Pipeline stage order
const stageOrderMap: Record<string, number> = {
  create: 1,
  research: 2,
  outline: 3,
  draft: 4,
  voice: 5,
  outputs: 6,
  utility: 99,
};

// Draggable Variable Component
function DraggableVariable({
  variable,
  onInsert,
  isUsed,
  useCount,
}: {
  variable: PromptVariable;
  onInsert: () => void;
  isUsed: boolean;
  useCount: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: variable.id,
    data: { variable },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
        isUsed
          ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
          : "bg-card hover:bg-muted/50 border-border"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none shrink-0"
        title="Drag to insert into prompt"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <button
        type="button"
        className="flex-1 text-left min-w-0 overflow-hidden"
        onClick={onInsert}
        title={`${variable.variable_name}\n${variable.description || variable.display_name}`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isUsed && (
            <Check className="h-3 w-3 text-green-600 shrink-0" />
          )}
          <span className={`text-sm font-mono break-all ${isUsed ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
            {variable.variable_name}
          </span>
          {useCount > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 font-medium">
              ×{useCount}
            </span>
          )}
          <Badge
            variant="outline"
            className={`text-[10px] px-1 shrink-0 ${
              variable.creator === "user"
                ? "border-blue-500 text-blue-600"
                : variable.creator === "ai"
                ? "border-purple-500 text-purple-600"
                : "border-gray-500 text-gray-600"
            }`}
          >
            {variable.creator}
          </Badge>
        </div>
      </button>
    </div>
  );
}

// Droppable Textarea Component
function DroppableTextarea({
  textareaRef,
  value,
  onChange,
  onBlur,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "prompt-textarea",
  });

  return (
    <div ref={setNodeRef} className="relative flex-1 min-h-0">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`h-full font-mono text-sm resize-none ${
          isOver ? "ring-2 ring-primary ring-offset-2" : ""
        }`}
        placeholder="Enter your prompt here. Use {{variable}} for interpolation."
      />
      {isOver && (
        <div className="absolute inset-0 pointer-events-none bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
          <span className="bg-background px-3 py-2 rounded text-sm text-primary font-medium">
            Drop to insert variable
          </span>
        </div>
      )}
    </div>
  );
}

export default function PromptEditorPage() {
  const params = useParams();
  const router = useRouter();
  const promptId = params.id as string;

  const [prompt, setPrompt] = useState<PromptSet | null>(null);
  const [currentVersion, setCurrentVersion] = useState<PromptVersion | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editorContent, setEditorContent] = useState("");
  const [editorModelId, setEditorModelId] = useState<string>("");
  const [editorTemperature, setEditorTemperature] = useState(0.7);
  const [editorMaxTokens, setEditorMaxTokens] = useState(4096);
  const [editorReasoningEnabled, setEditorReasoningEnabled] = useState(false);
  const [editorReasoningBudget, setEditorReasoningBudget] = useState(10000);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Variables
  const [availableVariables, setAvailableVariables] = useState<PromptVariable[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Version history
  const [allVersions, setAllVersions] = useState<PromptVersion[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);

  // Drag and drop
  const [activeDragVariable, setActiveDragVariable] = useState<PromptVariable | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number>(0);

  const supabase = createClient();

  // Load prompt data
  useEffect(() => {
    async function loadPrompt() {
      setIsLoading(true);
      setError(null);

      try {
        // Load prompt set
        const { data: promptData, error: promptError } = await supabase
          .from("prompt_sets")
          .select("*")
          .eq("id", promptId)
          .single();

        if (promptError) throw promptError;
        setPrompt(promptData);

        // Load current version
        if (promptData.current_version_id) {
          const { data: versionData } = await supabase
            .from("prompt_versions")
            .select("*")
            .eq("id", promptData.current_version_id)
            .single();

          if (versionData) {
            setCurrentVersion(versionData);
            setEditorContent(versionData.prompt_content);
            setEditorModelId(versionData.model_id || "");
            setEditorTemperature(versionData.api_config?.temperature || 0.7);
            setEditorMaxTokens(versionData.api_config?.max_tokens || 4096);
            setEditorReasoningEnabled(versionData.api_config?.reasoning_enabled || false);
            setEditorReasoningBudget(versionData.api_config?.reasoning_budget || 10000);
          }
        }

        // Load AI models
        const { data: aiModels } = await supabase
          .from("ai_models")
          .select("id, model_id, provider, display_name, supports_thinking")
          .eq("is_available", true)
          .order("display_name");

        setModels(aiModels || []);

        // Load variables for this prompt's stage
        await loadVariablesForPrompt(promptData.id, promptData.pipeline_stage);

        // Load all versions for history
        await loadAllVersions(promptData.id);

      } catch (err) {
        console.error("Failed to load prompt:", err);
        setError(err instanceof Error ? err.message : "Failed to load prompt");
      } finally {
        setIsLoading(false);
      }
    }

    if (promptId) {
      loadPrompt();
    }
  }, [promptId, supabase]);

  // Load variables for prompt's pipeline stage
  const loadVariablesForPrompt = async (_promptSetId: string, pipelineStage: string | null) => {
    const promptStageOrder = pipelineStage ? stageOrderMap[pipelineStage] || 99 : 99;

    // Load active variables
    const { data: vars, error: varsError } = await supabase
      .from("prompt_variables")
      .select("*")
      .eq("is_active", true)
      .order("category")
      .order("sort_order");

    if (varsError) {
      console.error("Failed to load variables:", varsError);
      return;
    }

    // Filter to only variables available BEFORE this prompt's stage
    // Exclude system metadata, UI state, and non-content categories
    const excludedCategories = ['session', 'user', 'model'];
    const excludedPatterns = [
      '_id_',           // IDs
      '_status_',       // Status flags
      '_created_at_',   // Timestamps
      '_updated_at_',   // Timestamps
      '_selected_',     // UI state (checkbox selections)
      '_skip_',         // Boolean workflow flags
    ];
    const filteredVars = (vars || []).filter(v => {
      const varStageOrder = stageOrderMap[v.available_after_stage] || 0;
      const isExcludedCategory = excludedCategories.includes(v.category);
      const isExcludedPattern = excludedPatterns.some(pattern => v.variable_name.includes(pattern));

      if (isExcludedCategory || isExcludedPattern) return false;

      // Same stage: only show USER inputs (not AI outputs - those don't exist yet)
      if (varStageOrder === promptStageOrder) {
        return v.creator === 'user';
      }

      // Earlier stages: show everything (user inputs + AI outputs)
      return varStageOrder < promptStageOrder;
    });

    setAvailableVariables(filteredVars);
  };

  // Load all versions for history view
  const loadAllVersions = async (promptSetId: string) => {
    const { data: versions, error: versionsError } = await supabase
      .from("prompt_versions")
      .select("*")
      .eq("prompt_set_id", promptSetId)
      .order("version", { ascending: false });

    if (versionsError) {
      console.error("Failed to load versions:", versionsError);
      return;
    }

    setAllVersions(versions || []);
  };

  // Archive a version
  const archiveVersion = async (versionId: string) => {
    if (!prompt) return;

    setIsArchiving(versionId);
    try {
      await supabase
        .from("prompt_versions")
        .update({ status: "archived" })
        .eq("id", versionId);

      // Reload versions
      await loadAllVersions(prompt.id);
    } catch (err) {
      console.error("Failed to archive version:", err);
    } finally {
      setIsArchiving(null);
    }
  };

  // Restore a version (make it active, archive others)
  const restoreVersion = async (version: PromptVersion) => {
    if (!prompt) return;

    setIsArchiving(version.id);
    try {
      // Archive all other active versions
      await supabase
        .from("prompt_versions")
        .update({ status: "archived" })
        .eq("prompt_set_id", prompt.id)
        .eq("status", "active");

      // Make this version active
      await supabase
        .from("prompt_versions")
        .update({ status: "active" })
        .eq("id", version.id);

      // Update prompt_set to point to this version
      await supabase
        .from("prompt_sets")
        .update({ current_version_id: version.id })
        .eq("id", prompt.id);

      // Reload everything
      setCurrentVersion(version);
      setEditorContent(version.prompt_content);
      setEditorModelId(version.model_id || "");
      setEditorTemperature(version.api_config?.temperature || 0.7);
      setEditorMaxTokens(version.api_config?.max_tokens || 4096);
      setEditorReasoningEnabled(version.api_config?.reasoning_enabled || false);
      setEditorReasoningBudget(version.api_config?.reasoning_budget || 10000);
      await loadAllVersions(prompt.id);
    } catch (err) {
      console.error("Failed to restore version:", err);
    } finally {
      setIsArchiving(null);
    }
  };

  // Track unsaved changes
  useEffect(() => {
    if (!currentVersion) return;

    const hasChanges =
      editorContent !== currentVersion.prompt_content ||
      editorModelId !== (currentVersion.model_id || "") ||
      editorTemperature !== (currentVersion.api_config?.temperature || 0.7) ||
      editorMaxTokens !== (currentVersion.api_config?.max_tokens || 4096) ||
      editorReasoningEnabled !== (currentVersion.api_config?.reasoning_enabled || false) ||
      editorReasoningBudget !== (currentVersion.api_config?.reasoning_budget || 10000);

    setHasUnsavedChanges(hasChanges);
  }, [editorContent, editorModelId, editorTemperature, editorMaxTokens, editorReasoningEnabled, editorReasoningBudget, currentVersion]);

  // Toggle category collapse
  const toggleCategoryCollapse = useCallback((category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Insert variable at cursor
  const insertVariableAtCursor = useCallback((variableName: string) => {
    const varText = `{{${variableName}}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setEditorContent(prev => prev + varText);
      return;
    }

    const cursorPos = textarea.selectionStart ?? cursorPositionRef.current ?? editorContent.length;
    const before = editorContent.slice(0, cursorPos);
    const after = editorContent.slice(cursorPos);
    const newContent = before + varText + after;
    setEditorContent(newContent);

    setTimeout(() => {
      if (textarea) {
        const newPos = cursorPos + varText.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }
    }, 0);
  }, [editorContent]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const variableId = event.active.id as string;
    const variable = availableVariables.find(v => v.id === variableId);
    if (variable) {
      setActiveDragVariable(variable);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragVariable(null);
    const { active, over } = event;
    if (!over || over.id !== "prompt-textarea") return;

    const variableId = active.id as string;
    const variable = availableVariables.find(v => v.id === variableId);
    if (variable) {
      insertVariableAtCursor(variable.variable_name);
    }
  };

  const handleTextareaBlur = () => {
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart || 0;
    }
  };

  // Save prompt
  const savePrompt = async () => {
    if (!prompt) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Get current max version
      const { data: maxVersion } = await supabase
        .from("prompt_versions")
        .select("version")
        .eq("prompt_set_id", prompt.id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = (maxVersion?.version || 0) + 1;

      // Archive current version
      if (prompt.current_version_id) {
        await supabase
          .from("prompt_versions")
          .update({ status: "archived" })
          .eq("id", prompt.current_version_id);
      }

      // Create new version
      const { data: newVersionData, error: insertError } = await supabase
        .from("prompt_versions")
        .insert({
          prompt_set_id: prompt.id,
          version: newVersion,
          prompt_content: editorContent,
          model_id: editorModelId || null,
          api_config: {
            temperature: editorTemperature,
            max_tokens: editorMaxTokens,
            reasoning_enabled: editorReasoningEnabled,
            reasoning_budget: editorReasoningBudget,
          },
          status: "active",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update prompt_set
      await supabase
        .from("prompt_sets")
        .update({ current_version_id: newVersionData.id })
        .eq("id", prompt.id);

      setCurrentVersion(newVersionData);
      setSaveSuccess(true);
      setHasUnsavedChanges(false);

      // Reload version history
      await loadAllVersions(prompt.id);

      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save prompt");
    } finally {
      setIsSaving(false);
    }
  };

  const getStageColor = (stage: string | null): string => {
    switch (stage) {
      case "create": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      case "research": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "outline": return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200";
      case "draft": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "voice": return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
      case "outputs": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
      case "utility": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Group variables by category
  const variablesByCategory = availableVariables.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {} as Record<string, PromptVariable[]>);

  // Check if selected model supports extended thinking
  const selectedModelSupportsThinking = useMemo(() => {
    const selectedModel = models.find(m => m.id === editorModelId);
    return selectedModel?.supports_thinking ?? false;
  }, [models, editorModelId]);

  // Calculate variable usage counts from editor content
  const variableUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Match all {{variable_name}} patterns
    const regex = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = regex.exec(editorContent)) !== null) {
      const varName = match[1];
      counts[varName] = (counts[varName] || 0) + 1;
    }
    return counts;
  }, [editorContent]);

  if (isLoading) {
    return (
      <div className="-m-6 h-[calc(100vh-14rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="-m-6 h-[calc(100vh-14rem)] flex flex-col items-center justify-center gap-4">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error || "Prompt not found"}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/studio/prompts")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Prompts
        </Button>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* -m-6 cancels parent padding, height accounts for dashboard header + studio title/tabs */}
      <div className="-m-6 h-[calc(100vh-14rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between bg-background shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/studio/prompts")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{prompt.name}</h1>
                {prompt.pipeline_stage && (
                  <Badge variant="secondary" className={getStageColor(prompt.pipeline_stage)}>
                    {prompt.pipeline_stage}
                  </Badge>
                )}
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                    Unsaved changes
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{prompt.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVersionHistory(!showVersionHistory)}
            >
              <History className="mr-2 h-4 w-4" />
              History ({allVersions.length})
            </Button>
            <Button onClick={savePrompt} disabled={isSaving || !hasUnsavedChanges}>
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
                  Save New Version
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Version History Panel */}
        {showVersionHistory && (
          <div className="border-b px-6 py-4 bg-muted/30 max-h-64 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Version History</h3>
              <Badge variant="outline">
                {allVersions.filter(v => v.status === "active").length} active
              </Badge>
            </div>
            <div className="space-y-2">
              {allVersions.map((version) => (
                <div
                  key={version.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    version.id === currentVersion?.id
                      ? "border-primary bg-primary/5"
                      : "bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">v{version.version}</span>
                    <Badge
                      variant={version.status === "active" ? "default" : "secondary"}
                      className={version.status === "active" ? "bg-green-600" : ""}
                    >
                      {version.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleString()}
                    </span>
                    {version.id === currentVersion?.id && (
                      <Badge variant="outline" className="text-xs">current</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {version.status === "active" && version.id !== currentVersion?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => archiveVersion(version.id)}
                        disabled={isArchiving === version.id}
                      >
                        {isArchiving === version.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Archive className="h-4 w-4 mr-1" />
                            Archive
                          </>
                        )}
                      </Button>
                    )}
                    {version.status === "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restoreVersion(version)}
                        disabled={isArchiving === version.id}
                      >
                        {isArchiving === version.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden min-h-0 border-2 border-border m-6 rounded-lg">
          {/* Left: Prompt Editor */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
            {/* Model Config */}
            <div className="space-y-4 mb-4 shrink-0">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={editorModelId} onValueChange={setEditorModelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.display_name}
                          {model.supports_thinking && (
                            <span className="ml-2 text-xs text-muted-foreground">🧠</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temperature ({editorTemperature})</Label>
                  <Input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={editorTemperature}
                    onChange={(e) => setEditorTemperature(parseFloat(e.target.value))}
                    disabled={editorReasoningEnabled}
                    className={editorReasoningEnabled ? "opacity-50" : ""}
                  />
                  {editorReasoningEnabled && (
                    <p className="text-xs text-muted-foreground">Disabled when thinking is enabled</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={editorMaxTokens}
                    onChange={(e) => setEditorMaxTokens(parseInt(e.target.value) || 4096)}
                  />
                </div>
              </div>

              {/* Extended Thinking Controls */}
              {selectedModelSupportsThinking && (
                <div className="flex items-center gap-6 p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="reasoning-toggle"
                      checked={editorReasoningEnabled}
                      onCheckedChange={setEditorReasoningEnabled}
                    />
                    <div>
                      <Label htmlFor="reasoning-toggle" className="cursor-pointer">
                        Extended Thinking
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Enable internal reasoning before responding
                      </p>
                    </div>
                  </div>
                  {editorReasoningEnabled && (
                    <div className="flex items-center gap-3 ml-auto">
                      <Label htmlFor="reasoning-budget" className="whitespace-nowrap">
                        Thinking Budget
                      </Label>
                      <Select
                        value={String(editorReasoningBudget)}
                        onValueChange={(v) => setEditorReasoningBudget(parseInt(v))}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4000">4k (Quick)</SelectItem>
                          <SelectItem value="8000">8k (Standard)</SelectItem>
                          <SelectItem value="16000">16k (Deep)</SelectItem>
                          <SelectItem value="32000">32k (Complex)</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">tokens</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Prompt Textarea */}
            <div className="flex-1 flex flex-col min-h-0">
              <Label className="mb-2 shrink-0">Prompt Content</Label>
              <DroppableTextarea
                textareaRef={textareaRef}
                value={editorContent}
                onChange={setEditorContent}
                onBlur={handleTextareaBlur}
              />
            </div>
          </div>

          {/* Right: Variables Panel */}
          <div className="w-96 border-l border-border bg-muted/30 flex flex-col shrink-0 overflow-hidden min-h-0">
            <div className="p-4 border-b bg-background">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Variables</h2>
                <div className="flex items-center gap-2">
                  {Object.keys(variableUsageCounts).length > 0 && (
                    <Badge variant="default" className="bg-green-600">
                      {Object.keys(variableUsageCounts).length} used
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {availableVariables.length} available
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Click or drag to insert into prompt
              </p>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-2">
                {Object.entries(variablesByCategory).map(([category, categoryVars]) => {
                  const isCollapsed = collapsedCategories.has(category);

                  return (
                    <Collapsible
                      key={category}
                      open={!isCollapsed}
                      onOpenChange={() => toggleCategoryCollapse(category)}
                    >
                      <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 hover:bg-muted rounded-lg text-left">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium capitalize text-sm">
                          {category.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {categoryVars.length}
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-1 mt-1 ml-6">
                        {categoryVars.map((variable) => {
                          const useCount = variableUsageCounts[variable.variable_name] || 0;
                          return (
                            <DraggableVariable
                              key={variable.id}
                              variable={variable}
                              onInsert={() => insertVariableAtCursor(variable.variable_name)}
                              isUsed={useCount > 0}
                              useCount={useCount}
                            />
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDragVariable && (
            <div className="bg-background border rounded-lg p-2 shadow-lg">
              <code className="text-sm bg-primary/20 text-primary px-2 py-1 rounded font-mono">
                {`{{${activeDragVariable.variable_name}}}`}
              </code>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
