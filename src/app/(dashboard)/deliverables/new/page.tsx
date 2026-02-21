"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TurndownService from "turndown";
import { useCreateProject } from "@/hooks/use-deliverables";
import { useAssetConfig } from "@/hooks/use-asset-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2 } from "lucide-react";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

function extractTitle(markdown: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^#\s+(.+)/);
    if (headingMatch) return headingMatch[1].trim();
    return trimmed;
  }
  return "Untitled";
}

function countWords(text: string): number {
  return text
    .replace(/[#*_`~\[\]()>|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function NewDeliverablePage() {
  const router = useRouter();
  const createProject = useCreateProject();
  const { config: assetConfig } = useAssetConfig();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const html = e.clipboardData.getData("text/html");
      if (!html) return; // plain text falls through to default behavior
      e.preventDefault();
      const md = turndownService.turndown(html);

      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const next = val.substring(0, start) + md + val.substring(end);
      setContent(next);

      // Auto-fill title from pasted content if title is empty
      if (!title) {
        setTitle(extractTitle(next));
      }

      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + md.length;
      });
    },
    [title]
  );

  // Also extract title when user types/pastes plain text and title is empty
  function handleContentChange(value: string) {
    setContent(value);
    if (!title && value.trim()) {
      setTitle(extractTitle(value));
    }
  }

  async function handleCreate() {
    const finalTitle = title.trim() || "Untitled";
    const wordCount = countWords(content);

    const { asset_type, platform, variant } = assetConfig.defaults.new_project;
    createProject.mutate(
      {
        name: finalTitle,
        content,
        metadata: { word_count: wordCount },
        initialAssetType: asset_type,
        initialPlatform: platform,
        initialVariant: variant,
      },
      {
        onSuccess: (project) => {
          router.push(`/deliverables/${project.id}`);
        },
        onError: (err) => {
          showToast(`Failed to create: ${(err as Error).message}`);
        },
      }
    );
  }

  const canCreate = content.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/deliverables"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to deliverables
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">New project</h1>
        <p className="text-sm text-muted-foreground">
          Paste post content to create a new deliverable project
        </p>
      </div>

      {/* Title input */}
      <div className="space-y-2">
        <label
          htmlFor="project-title"
          className="text-sm font-medium text-foreground"
        >
          Title
        </label>
        <Input
          id="project-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto-extracted from content, or type here..."
        />
      </div>

      {/* Content paste area */}
      <div className="space-y-2">
        <label
          htmlFor="project-content"
          className="text-sm font-medium text-foreground"
        >
          Content
        </label>
        <textarea
          id="project-content"
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onPaste={handlePaste}
          className="w-full min-h-[250px] sm:min-h-[400px] rounded-lg border border-border bg-card p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          placeholder="Paste rich text (HTML will convert to markdown) or type markdown directly..."
          spellCheck={false}
        />
        {content && (
          <p className="text-xs text-muted-foreground">
            {countWords(content).toLocaleString()} words
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleCreate}
          disabled={!canCreate || createProject.isPending}
        >
          {createProject.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Create project
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/deliverables">Cancel</Link>
        </Button>
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
