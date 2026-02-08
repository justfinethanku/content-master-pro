"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TurndownService from "turndown";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PostMarkdown } from "@/components/post-markdown";
import {
  ArrowLeft,
  Eye,
  Pencil,
  Package,
  Loader2,
  Save,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ContentRow {
  id: string;
  post_id: string;
  content_type: string;
  version: number;
  content: string;
  name: string | null;
  description: string | null;
  environment: string | null;
  prompt_count: number | null;
  created_at: string;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  post_number: number;
  status: string;
  batch_date: string;
}

interface PostViewerProps {
  post: Post;
  content: Record<string, ContentRow[]>;
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

export function PostViewer({ post, content: initialContent }: PostViewerProps) {
  const router = useRouter();

  // Content state (can be refreshed after saves)
  const [content, setContent] = useState(initialContent);

  // Layout mode
  const [splitMode, setSplitMode] = useState(false);

  // Left panel (post content)
  const [leftViewMode, setLeftViewMode] = useState<"view" | "edit">("view");
  const [selectedPostVersion, setSelectedPostVersion] = useState(() => {
    const postVersions = content["post"] || [];
    return postVersions.length > 0
      ? postVersions[postVersions.length - 1].version
      : 0;
  });
  const [leftEditContent, setLeftEditContent] = useState("");
  const [leftDirty, setLeftDirty] = useState(false);

  // Right panel (prompt pack)
  const [rightViewMode, setRightViewMode] = useState<"view" | "edit">("view");
  const [selectedPackVersion, setSelectedPackVersion] = useState(() => {
    const packVersions = content["prompt_pack"] || [];
    return packVersions.length > 0
      ? packVersions[packVersions.length - 1].version
      : 0;
  });
  const [rightEditContent, setRightEditContent] = useState("");
  const [rightDirty, setRightDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"left" | "right" | null>(null);

  const leftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Helpers
  const postVersions = content["post"] || [];
  const packVersions = content["prompt_pack"] || [];
  const hasPromptPack = packVersions.length > 0;

  const currentPostContent =
    postVersions.find((c) => c.version === selectedPostVersion)?.content || "";
  const currentPackContent =
    packVersions.find((c) => c.version === selectedPackVersion)?.content || "";

  // Paste handler: convert rich text HTML to markdown
  const handlePaste = useCallback(
    (
      e: React.ClipboardEvent<HTMLTextAreaElement>,
      setter: (val: string) => void,
      dirtySetter: (val: boolean) => void,
      textareaRef: React.RefObject<HTMLTextAreaElement | null>
    ) => {
      const html = e.clipboardData.getData("text/html");
      if (!html) return; // let default plain text paste happen

      e.preventDefault();
      const markdown = turndownService.turndown(html);

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentVal = textarea.value;
      const newVal =
        currentVal.substring(0, start) + markdown + currentVal.substring(end);

      setter(newVal);
      dirtySetter(true);

      // Restore cursor position after the pasted content
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd =
          start + markdown.length;
      });
    },
    []
  );

  // Enter edit mode
  function startEditing(side: "left" | "right") {
    if (side === "left") {
      setLeftEditContent(currentPostContent);
      setLeftViewMode("edit");
      setLeftDirty(false);
    } else {
      setRightEditContent(currentPackContent);
      setRightViewMode("edit");
      setRightDirty(false);
    }
  }

  // Cancel edit
  function cancelEdit(side: "left" | "right") {
    if (side === "left") {
      setLeftViewMode("view");
      setLeftDirty(false);
    } else {
      setRightViewMode("view");
      setRightDirty(false);
    }
  }

  // Save new version
  async function saveVersion(side: "left" | "right") {
    setSaving(true);
    const contentType = side === "left" ? "post" : "prompt_pack";
    const contentBody = side === "left" ? leftEditContent : rightEditContent;

    try {
      const res = await fetch(`/api/posts/${post.id}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: post.id,
          content_type: contentType,
          content: contentBody,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();
      const newRow: ContentRow = data.content;

      // Update local content state
      setContent((prev) => {
        const updated = { ...prev };
        const existing = updated[contentType] || [];
        updated[contentType] = [...existing, newRow];
        return updated;
      });

      // Select the new version and exit edit mode
      if (side === "left") {
        setSelectedPostVersion(newRow.version);
        setLeftViewMode("view");
        setLeftDirty(false);
      } else {
        setSelectedPackVersion(newRow.version);
        setRightViewMode("view");
        setRightDirty(false);
      }

      toast.success(`Saved as v${newRow.version}`);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Copy content to clipboard
  async function copyContent(side: "left" | "right") {
    const text = side === "left" ? currentPostContent : currentPackContent;
    await navigator.clipboard.writeText(text);
    setCopied(side);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  }

  // Toggle split mode
  function toggleSplit() {
    setSplitMode((prev) => !prev);
  }

  // Render a content panel
  function renderPanel(
    side: "left" | "right",
    viewMode: "view" | "edit",
    contentText: string,
    editContent: string,
    setEditContent: (val: string) => void,
    dirty: boolean,
    setDirty: (val: boolean) => void,
    textareaRef: React.RefObject<HTMLTextAreaElement | null>,
    versions: ContentRow[],
    selectedVersion: number,
    setSelectedVersion: (v: number) => void,
    contentType: string
  ) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground capitalize">
              {contentType === "prompt_pack" ? "Prompt Pack" : "Post"}
            </span>
            {versions.length > 0 && (
              <Select
                value={String(selectedVersion)}
                onValueChange={(v) => {
                  setSelectedVersion(Number(v));
                  if (viewMode === "edit") {
                    const row = versions.find(
                      (r) => r.version === Number(v)
                    );
                    if (row) {
                      setEditContent(row.content);
                      setDirty(false);
                    }
                  }
                }}
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.version} value={String(v.version)}>
                      v{v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Copy button */}
            {viewMode === "view" && contentText && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => copyContent(side)}
              >
                {copied === side ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

            {/* View/Edit toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => {
                  if (viewMode === "edit") cancelEdit(side);
                }}
                className={cn(
                  "px-2 py-1 text-xs transition-colors",
                  viewMode === "view"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  if (viewMode === "view") startEditing(side);
                }}
                className={cn(
                  "px-2 py-1 text-xs transition-colors",
                  viewMode === "edit"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {viewMode === "view" ? (
            contentText ? (
              <div className="p-6">
                <PostMarkdown content={contentText} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No content yet. Switch to edit mode to add content.
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
                onPaste={(e) =>
                  handlePaste(e, setEditContent, setDirty, textareaRef)
                }
                className="flex-1 w-full p-6 bg-transparent text-foreground font-mono text-sm resize-none focus:outline-none"
                placeholder={`Paste or type ${contentType === "prompt_pack" ? "prompt pack" : "post"} content here...`}
                spellCheck={false}
              />
              {dirty && (
                <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-border bg-card/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelEdit(side)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveVersion(side)}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save as new version
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-2 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/posts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {post.title}
            </h1>
            <span className="text-xs text-muted-foreground">
              #{post.post_number} &middot; {post.batch_date}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Prompt Pack toggle */}
          <Button
            variant={splitMode ? "default" : "outline"}
            size="sm"
            onClick={toggleSplit}
            disabled={!hasPromptPack && !splitMode}
            title={
              hasPromptPack
                ? "Toggle prompt pack panel"
                : "No prompt pack available"
            }
          >
            <Package className="h-4 w-4 mr-1" />
            Prompt Pack
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div
        className={cn(
          "flex-1 min-h-0 border border-border rounded-lg overflow-hidden",
          splitMode ? "grid grid-cols-2" : "flex flex-col"
        )}
      >
        {/* Left / Single panel: Post */}
        <div
          className={cn(
            "flex flex-col min-h-0",
            splitMode && "border-r border-border"
          )}
        >
          {renderPanel(
            "left",
            leftViewMode,
            currentPostContent,
            leftEditContent,
            setLeftEditContent,
            leftDirty,
            setLeftDirty,
            leftTextareaRef,
            postVersions,
            selectedPostVersion,
            setSelectedPostVersion,
            "post"
          )}
        </div>

        {/* Right panel: Prompt Pack (only in split mode) */}
        {splitMode && (
          <div className="flex flex-col min-h-0">
            {renderPanel(
              "right",
              rightViewMode,
              currentPackContent,
              rightEditContent,
              setRightEditContent,
              rightDirty,
              setRightDirty,
              rightTextareaRef,
              packVersions,
              selectedPackVersion,
              setSelectedPackVersion,
              "prompt_pack"
            )}
          </div>
        )}
      </div>
    </div>
  );
}
