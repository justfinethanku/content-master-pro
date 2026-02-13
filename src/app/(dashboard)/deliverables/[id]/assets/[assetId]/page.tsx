"use client";

import { useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TurndownService from "turndown";
import { useDeliverableAsset, useProjectPromptKits, useCreatePromptKitAsset } from "@/hooks/use-deliverables";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deliverableKeys } from "@/hooks/use-deliverables";
import { useGenerate } from "@/hooks/use-generate";
import { useAssetVersions } from "@/hooks/use-asset-versions";
import { versionKeys } from "@/hooks/use-asset-versions";
import PostMarkdown from "@/components/post-markdown";
import { copyRichText } from "@/lib/utils/markdown-to-html";
import type { ProjectAsset } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, ChevronDown, ExternalLink, FileCode, Loader2, PanelRightClose, PanelRightOpen, Sparkles, Trash2 } from "lucide-react";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

export default function AssetEditorPage() {
  const params = useParams();
  const projectId = params.id as string;
  const assetId = params.assetId as string;

  const { data: asset, isLoading, error } = useDeliverableAsset(assetId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link
          href={`/deliverables/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="text-muted-foreground">
          {error ? `Error: ${(error as Error).message}` : "Asset not found"}
        </p>
      </div>
    );
  }

  return <AssetEditorInner asset={asset} projectId={projectId} />;
}

function PromptKitPanel({
  promptKits,
  activeIndex,
  setActiveIndex,
  onClose,
}: {
  promptKits: ProjectAsset[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onClose: () => void;
}) {
  const pk = promptKits[activeIndex];

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col min-h-[40vh] lg:h-[calc(100vh-12rem)] lg:w-[420px] lg:shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground truncate">
            {promptKits.length === 1 ? "Prompt Kit" : pk.name}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary shrink-0">
            v{pk.version}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition p-1 shrink-0"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Tab bar for multiple prompt kits */}
      {promptKits.length > 1 && (
        <div className="flex border-b border-border bg-muted/20 overflow-x-auto flex-shrink-0">
          {promptKits.map((kit, i) => (
            <button
              key={kit.id}
              onClick={() => setActiveIndex(i)}
              className={`px-3 py-1.5 text-xs whitespace-nowrap transition ${
                i === activeIndex
                  ? "border-b-2 border-primary text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {kit.name}
            </button>
          ))}
        </div>
      )}

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        {pk.content ? (
          <PostMarkdown content={pk.content} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No prompt kit content yet.
          </p>
        )}
      </div>
    </div>
  );
}

function AssetEditorInner({
  asset,
  projectId,
}: {
  asset: NonNullable<ReturnType<typeof useDeliverableAsset>["data"]>;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [editContent, setEditContent] = useState(asset.content || "");
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPromptKit, setShowPromptKit] = useState(false);
  const [activePkIndex, setActivePkIndex] = useState(0);
  const [converting, setConverting] = useState(false);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [viewingVersionContent, setViewingVersionContent] = useState<string | null>(null);
  const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [generatingPreamble, setGeneratingPreamble] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentContent = asset.content || "";
  const meta = asset.metadata as Record<string, unknown>;
  const wordCount = meta?.word_count as number | undefined;

  // Version history
  const { data: versions = [] } = useAssetVersions(asset.id);
  const hasMultipleVersions = versions.length > 1;

  // Fetch prompt kit siblings — skip if the current asset IS a prompt kit
  const isPromptKit = asset.asset_type === "promptkit";
  const { data: promptKits = [] } = useProjectPromptKits(
    isPromptKit ? null : projectId
  );

  const hasPromptKits = !isPromptKit && promptKits.length > 0;

  // Preamble detection
  const hasPreamble = !!(
    (meta?.preamble_added_at) ||
    currentContent.includes("[Grab the prompts](https://promptkits.natebjones.com/")
  );

  // AI generation for prompt kit conversion
  const {
    generate,
    isLoading: isGenerating,
    streamedContent,
    error: generateError,
    reset: resetGenerate,
  } = useGenerate();

  const createPromptKitAsset = useCreatePromptKitAsset();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleConvert = useCallback(async () => {
    setConverting(true);
    setShowPromptKit(true);
    resetGenerate();

    const result = await generate({
      prompt_slug: "prompt_kit_converter",
      variables: { content: currentContent },
      stream: true,
    });

    if (result?.success && result.content) {
      createPromptKitAsset.mutate(
        {
          projectId,
          name: `${asset.name} Prompt Kit`,
          content: result.content,
        },
        {
          onSuccess: () => {
            setConverting(false);
            showToast("Prompt kit created");
          },
          onError: () => {
            setConverting(false);
            showToast("Failed to save prompt kit");
          },
        }
      );
    }
    // If generation failed, don't close the panel — leave it open
    // so the error UI and Retry button are visible
  }, [currentContent, projectId, asset.name, generate, resetGenerate, createPromptKitAsset, showToast]);

  // Preamble generation (reuses the same generate hook — sequential, not concurrent)
  const {
    generate: generatePreamble,
    isLoading: isPreambleGenerating,
    streamedContent: preambleStreamedContent,
    error: preambleError,
    reset: resetPreamble,
  } = useGenerate();

  const handleAddPreamble = useCallback(async () => {
    if (!promptKits.length) return;
    setGeneratingPreamble(true);
    setShowPromptKit(true);
    resetPreamble();

    const promptKitLink = `https://promptkits.natebjones.com/${promptKits[0].asset_id}`;

    const result = await generatePreamble({
      prompt_slug: "post_preamble_generator",
      variables: { content: currentContent, prompt_kit_link: promptKitLink },
      stream: true,
    });

    if (result?.success && result.content) {
      // Prepend preamble + separator + original content
      const newContent = result.content.trim() + "\n\n---\n\n" + currentContent;
      const nextVersion = asset.version + 1;

      const supabase = createClient();

      // Get current user for version snapshot
      const { data: { user } } = await supabase.auth.getUser();

      // Update asset with preamble content + metadata flag
      const { error: updateError } = await supabase
        .from("project_assets")
        .update({
          content: newContent,
          version: nextVersion,
          metadata: {
            ...(meta || {}),
            preamble_added_at: new Date().toISOString(),
            prompt_kit_link: promptKitLink,
          },
        })
        .eq("id", asset.id);

      if (updateError) {
        showToast("Failed to save preamble");
        setGeneratingPreamble(false);
        return;
      }

      // Create version snapshot
      if (user) {
        await supabase.from("asset_versions").insert({
          asset_id: asset.id,
          version_number: nextVersion,
          content: newContent,
          created_by: user.id,
        });
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: deliverableKeys.asset(asset.id) });
      queryClient.invalidateQueries({ queryKey: deliverableKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: versionKeys.list(asset.id) });

      setGeneratingPreamble(false);
      showToast(`Preamble added — saved as v${nextVersion}`);
    } else {
      setGeneratingPreamble(false);
    }
  }, [currentContent, promptKits, asset.id, asset.version, meta, projectId, generatePreamble, resetPreamble, queryClient, showToast]);

  // Delete asset mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();

      // Delete associated prompt kits first (if this is a post, not a prompt kit)
      if (!isPromptKit && promptKits.length > 0) {
        const promptKitIds = promptKits.map((pk) => pk.id);
        const { error: pkError } = await supabase
          .from("project_assets")
          .delete()
          .in("id", promptKitIds);
        if (pkError) throw pkError;
      }

      // Delete the asset itself (asset_versions cascade-delete via FK)
      const { error } = await supabase
        .from("project_assets")
        .delete()
        .eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.detail(projectId) });
      router.push(`/deliverables/${projectId}`);
    },
    onError: () => {
      showToast("Failed to delete");
      setDeleting(false);
    },
  });

  // Save mutation — updates asset content + creates version snapshot
  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const supabase = createClient();
      const nextVersion = asset.version + 1;

      // Update asset
      const { error } = await supabase
        .from("project_assets")
        .update({
          content: newContent,
          version: nextVersion,
        })
        .eq("id", asset.id);
      if (error) throw error;

      // Create version snapshot
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("asset_versions").insert({
          asset_id: asset.id,
          version_number: nextVersion,
          content: newContent,
          created_by: user.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.asset(asset.id),
      });
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.detail(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: versionKeys.list(asset.id),
      });
      setViewMode("view");
      setDirty(false);
      showToast(`Saved as v${asset.version + 1}`);
    },
    onError: () => {
      showToast("Failed to save");
    },
  });

  // Paste handler: HTML -> markdown
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const html = e.clipboardData.getData("text/html");
      if (!html) return;
      e.preventDefault();
      const md = turndownService.turndown(html);
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const next = val.substring(0, start) + md + val.substring(end);
      setEditContent(next);
      setDirty(true);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + md.length;
      });
    },
    []
  );

  function startEdit() {
    setEditContent(currentContent);
    setViewMode("edit");
    setDirty(false);
  }

  function cancelEdit() {
    setViewMode("view");
    setDirty(false);
  }

  async function copyContent() {
    const contentToCopy = viewingVersionContent ?? currentContent;
    try {
      await copyRichText(contentToCopy);
      showToast("Copied as rich text");
    } catch {
      await navigator.clipboard.writeText(contentToCopy);
      showToast("Copied to clipboard");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Version viewing helpers
  function viewVersion(version: { id: string; version_number: number; content: string | null }) {
    setViewingVersionId(version.id);
    setViewingVersionContent(version.content ?? "");
    setViewingVersionNumber(version.version_number);
    setShowVersionDropdown(false);
    setViewMode("view");
  }

  function backToCurrent() {
    setViewingVersionId(null);
    setViewingVersionContent(null);
    setViewingVersionNumber(null);
  }

  return (
    <div className="px-0 md:px-2 py-2 md:py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/deliverables/${projectId}`}
            className="text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {asset.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {asset.asset_type}
              </span>
              {asset.platform && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {asset.platform}
                  </span>
                </>
              )}
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                v{asset.version}
              </span>
              {wordCount && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {wordCount.toLocaleString()} words
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Preamble button — show when: has prompt kits, not a prompt kit, no preamble yet, has content */}
          {hasPromptKits && !isPromptKit && !hasPreamble && !generatingPreamble && currentContent && !viewingVersionId && (
            <button
              onClick={handleAddPreamble}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition min-h-[36px]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Add Preamble</span>
            </button>
          )}

          {/* Prompt Kit actions */}
          {hasPromptKits ? (
            <>
              <button
                onClick={() => setShowPromptKit((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:bg-muted transition min-h-[36px]"
                title={showPromptKit ? "Hide prompt kit" : "Show prompt kit side-by-side"}
              >
                {showPromptKit ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
                <span>
                  {showPromptKit ? "Hide" : "Prompt Kit"}
                </span>
              </button>
              <Link
                href={`/deliverables/${projectId}/assets/${promptKits[0].id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:bg-muted transition min-h-[36px]"
                title="Open prompt kit page"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Prompt Kit</span>
              </Link>
            </>
          ) : !isPromptKit && !converting && currentContent && !viewingVersionId && (
            <button
              onClick={handleConvert}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition min-h-[36px]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Convert to Prompt Kit</span>
            </button>
          )}

          {/* Delete button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="inline-flex items-center justify-center p-2 text-muted-foreground hover:text-destructive transition rounded-md min-h-[36px]"
                title="Delete asset"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
                <AlertDialogDescription>
                  {hasPromptKits ? (
                    <>
                      This will permanently delete <strong>{asset.name}</strong> and its companion <strong>prompt kit</strong>. All versions will be lost. This cannot be undone.
                    </>
                  ) : (
                    <>
                      This will permanently delete <strong>{asset.name}</strong> and all its versions. This cannot be undone.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setDeleting(true);
                    deleteMutation.mutate();
                  }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content area — split layout when prompt kit or converting panel is visible */}
      <div className={`flex gap-4 ${(showPromptKit && hasPromptKits) || converting || generatingPreamble ? "flex-col lg:flex-row" : ""}`}>
        {/* Main content panel */}
        <div className={`border border-border rounded-lg overflow-hidden bg-card flex flex-col min-h-[50vh] md:h-[calc(100vh-12rem)] ${(showPromptKit && hasPromptKits) || converting || generatingPreamble ? "lg:flex-1 lg:min-w-0" : "w-full"}`}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                Content
              </span>
              {/* Version badge / dropdown */}
              {viewingVersionId ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    viewing v{viewingVersionNumber}
                  </span>
                  <button
                    onClick={backToCurrent}
                    className="text-xs text-primary hover:text-primary/80 transition font-medium"
                  >
                    Back to current
                  </button>
                </div>
              ) : hasMultipleVersions ? (
                <div className="relative">
                  <button
                    onClick={() => setShowVersionDropdown((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary hover:bg-primary/20 transition"
                  >
                    v{asset.version}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showVersionDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowVersionDropdown(false)}
                      />
                      <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px] max-h-[240px] overflow-y-auto">
                        {versions.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => viewVersion(v)}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition flex items-center justify-between gap-3 ${
                              v.version_number === asset.version
                                ? "text-primary font-medium"
                                : "text-foreground"
                            }`}
                          >
                            <span>v{v.version_number}{v.version_number === asset.version ? " (current)" : ""}</span>
                            <span className="text-muted-foreground">
                              {formatRelativeTime(v.created_at)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                  v{asset.version}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {viewMode === "view" && (currentContent || viewingVersionContent) && (
                <button
                  onClick={copyContent}
                  className="text-xs text-muted-foreground hover:text-primary transition"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
              {!viewingVersionId && (
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    onClick={() => {
                      if (viewMode === "edit") cancelEdit();
                    }}
                    className={`px-2.5 py-1 min-h-[36px] text-xs transition ${
                      viewMode === "view"
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    View
                  </button>
                  <button
                    onClick={() => {
                      if (viewMode === "view") startEdit();
                    }}
                    className={`px-2.5 py-1 min-h-[36px] text-xs transition ${
                      viewMode === "edit"
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {viewingVersionId ? (
              viewingVersionContent ? (
                <div className="p-4 sm:p-6">
                  <PostMarkdown content={viewingVersionContent} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  This version has no content.
                </div>
              )
            ) : viewMode === "view" ? (
              currentContent ? (
                <div className="p-4 sm:p-6">
                  <PostMarkdown content={currentContent} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No content yet. Switch to Edit to add content.
                </div>
              )
            ) : (
              <div className="flex flex-col h-full">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setDirty(true);
                  }}
                  onPaste={handlePaste}
                  className="flex-1 w-full p-4 sm:p-6 bg-transparent text-foreground font-mono text-sm resize-none focus:outline-none"
                  placeholder="Paste or type post content..."
                  spellCheck={false}
                />
                {dirty && (
                  <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30">
                    <button
                      onClick={cancelEdit}
                      disabled={saveMutation.isPending}
                      className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveMutation.mutate(editContent)}
                      disabled={saveMutation.isPending}
                      className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      {saveMutation.isPending ? "Saving..." : "Save as new version"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Converting / Preamble panel — shown during AI generation */}
        {(converting || generatingPreamble) && (
          <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col min-h-[40vh] lg:h-[calc(100vh-12rem)] lg:w-[420px] lg:shrink-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {generatingPreamble ? "Generating Preamble" : "Generating Prompt Kit"}
                </span>
                {(isGenerating || isPreambleGenerating) && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>
              {(generateError || preambleError) && (
                <button
                  onClick={() => {
                    setConverting(false);
                    setGeneratingPreamble(false);
                    setShowPromptKit(false);
                    resetGenerate();
                    resetPreamble();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Dismiss
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
              {(generateError || preambleError) ? (
                <div className="space-y-4">
                  <p className="text-sm text-destructive">
                    {(generateError || preambleError)?.message}
                  </p>
                  <button
                    onClick={generatingPreamble ? handleAddPreamble : handleConvert}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              ) : (streamedContent || preambleStreamedContent) ? (
                <PostMarkdown content={generatingPreamble ? preambleStreamedContent : streamedContent} />
              ) : (isGenerating || isPreambleGenerating) ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Prompt Kit side panel */}
        {showPromptKit && hasPromptKits && !converting && !generatingPreamble && (
          <PromptKitPanel
            promptKits={promptKits}
            activeIndex={activePkIndex}
            setActiveIndex={setActivePkIndex}
            onClose={() => setShowPromptKit(false)}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-foreground text-background px-4 py-2 rounded-lg text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
