"use client";

import { useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TurndownService from "turndown";
import { useDeliverableAsset, useProjectPromptKits, useCreatePromptKitAsset } from "@/hooks/use-deliverables";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deliverableKeys } from "@/hooks/use-deliverables";
import { useGenerate } from "@/hooks/use-generate";
import PostMarkdown from "@/components/post-markdown";
import type { ProjectAsset } from "@/lib/types";
import { ArrowLeft, ExternalLink, FileCode, Loader2, PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react";

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

  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [editContent, setEditContent] = useState(asset.content || "");
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPromptKit, setShowPromptKit] = useState(false);
  const [activePkIndex, setActivePkIndex] = useState(0);
  const [converting, setConverting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentContent = asset.content || "";
  const meta = asset.metadata as Record<string, unknown>;
  const wordCount = meta?.word_count as number | undefined;

  // Fetch prompt kit siblings — skip if the current asset IS a prompt kit
  const isPromptKit = asset.asset_type === "promptkit";
  const { data: promptKits = [] } = useProjectPromptKits(
    isPromptKit ? null : projectId
  );

  const hasPromptKits = !isPromptKit && promptKits.length > 0;

  // AI generation for prompt kit conversion
  const {
    generate,
    isLoading: isGenerating,
    streamedContent,
    result: generateResult,
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

  // Save mutation — updates asset content directly
  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_assets")
        .update({
          content: newContent,
          version: asset.version + 1,
        })
        .eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.asset(asset.id),
      });
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.detail(projectId),
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
    await navigator.clipboard.writeText(currentContent);
    setCopied(true);
    showToast("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
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

        {/* Prompt Kit actions */}
        {hasPromptKits ? (
          <div className="flex items-center gap-2">
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
          </div>
        ) : !isPromptKit && !converting && currentContent && (
          <button
            onClick={handleConvert}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition min-h-[36px]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Convert to Prompt Kit</span>
          </button>
        )}
      </div>

      {/* Content area — split layout when prompt kit or converting panel is visible */}
      <div className={`flex gap-4 ${(showPromptKit && hasPromptKits) || converting ? "flex-col lg:flex-row" : ""}`}>
        {/* Main content panel */}
        <div className={`border border-border rounded-lg overflow-hidden bg-card flex flex-col min-h-[50vh] md:h-[calc(100vh-12rem)] ${(showPromptKit && hasPromptKits) || converting ? "lg:flex-1 lg:min-w-0" : "w-full"}`}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                Content
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                v{asset.version}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {viewMode === "view" && currentContent && (
                <button
                  onClick={copyContent}
                  className="text-xs text-muted-foreground hover:text-primary transition"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
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
            </div>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {viewMode === "view" ? (
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

        {/* Converting panel — shown during AI generation */}
        {converting && (
          <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col min-h-[40vh] lg:h-[calc(100vh-12rem)] lg:w-[420px] lg:shrink-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Generating Prompt Kit
                </span>
                {isGenerating && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>
              {generateError && (
                <button
                  onClick={() => {
                    setConverting(false);
                    setShowPromptKit(false);
                    resetGenerate();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Dismiss
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
              {generateError ? (
                <div className="space-y-4">
                  <p className="text-sm text-destructive">
                    {generateError.message}
                  </p>
                  <button
                    onClick={handleConvert}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              ) : streamedContent ? (
                <PostMarkdown content={streamedContent} />
              ) : isGenerating ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Prompt Kit side panel */}
        {showPromptKit && hasPromptKits && !converting && (
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
