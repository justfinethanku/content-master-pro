"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowLeft,
  Copy,
  Download,
  Mic,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGenerate, useGenerateJSON } from "@/hooks/use-generate";
import { CrossReferencePanel } from "@/components/cross-reference-panel";

interface OutlineData {
  title: string;
  subtitle: string;
  hook: string;
  sections: Array<{
    title: string;
    key_points: string[];
  }>;
  conclusion_approach: string;
  call_to_action?: string;
  research_summary?: string;
}

interface VoiceScore {
  overall_score: number;
  scores: {
    tone: number;
    style: number;
    vocabulary: number;
    personality: number;
  };
  strengths: string[];
  warnings: string[];
  suggestions: string[];
}

export default function DraftPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoadingOutline, setIsLoadingOutline] = useState(true);
  const [voiceScore, setVoiceScore] = useState<VoiceScore | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [existingDraftLoaded, setExistingDraftLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Use the universal generate hooks
  const {
    generate: generateDraft,
    isLoading: isGenerating,
    error: draftError,
    streamedContent,
  } = useGenerate();

  const {
    generateJSON: checkVoice,
    isLoading: isCheckingVoice,
    error: voiceError,
  } = useGenerateJSON<VoiceScore>();

  const error = loadError || draftError?.message || voiceError?.message || null;

  // Load outline and existing draft from database using session_id
  useEffect(() => {
    async function loadOutlineAndDraft() {
      if (!sessionId) {
        setIsLoadingOutline(false);
        return;
      }

      try {
        const supabase = createClient();

        // Fetch outline for this session
        const { data: outlineData, error: outlineError } = await supabase
          .from("content_outlines")
          .select("outline_json")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (outlineError && outlineError.code !== "PGRST116") {
          console.error("Failed to load outline:", outlineError);
          setLoadError("Failed to load outline data");
          setIsLoadingOutline(false);
          return;
        }

        if (outlineData?.outline_json) {
          // Also fetch research summary if available
          const { data: researchData } = await supabase
            .from("content_research")
            .select("response")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          setOutline({
            ...outlineData.outline_json,
            research_summary: researchData?.response,
          });
        }

        // Check for existing draft BEFORE auto-generating
        const { data: existingDraft, error: draftError } = await supabase
          .from("content_drafts")
          .select("content, voice_score")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (draftError && draftError.code !== "PGRST116") {
          console.error("Failed to load existing draft:", draftError);
        }

        if (existingDraft?.content) {
          setDraft(existingDraft.content);
          setExistingDraftLoaded(true);
          if (existingDraft.voice_score) {
            setVoiceScore(existingDraft.voice_score);
          }
        }
      } catch (err) {
        console.error("Error loading outline:", err);
        setLoadError("Failed to load outline data");
      } finally {
        setIsLoadingOutline(false);
      }
    }

    loadOutlineAndDraft();
  }, [sessionId]);

  const handleGenerateDraft = useCallback(async () => {
    if (!outline) return;

    setVoiceScore(null);

    // Use the universal generate endpoint with streaming
    const result = await generateDraft({
      prompt_slug: "draft_writer_substack",
      session_id: sessionId || undefined,
      variables: {
        content: JSON.stringify({
          title: outline.title,
          subtitle: outline.subtitle,
          hook: outline.hook,
          sections: outline.sections,
          conclusion_approach: outline.conclusion_approach,
          call_to_action: outline.call_to_action,
        }),
        research_summary: outline.research_summary || "",
      },
      stream: true,
    });

    if (result?.success && result.content) {
      setDraft(result.content);

      // Update session status to 'draft'
      if (sessionId) {
        const supabase = createClient();
        await supabase
          .from("content_sessions")
          .update({ status: "draft" })
          .eq("id", sessionId);
      }
    }
  }, [outline, sessionId, generateDraft]);

  // Auto-generate on mount if outline is available AND no existing draft was loaded
  useEffect(() => {
    if (outline && !draft && !isGenerating && !isLoadingOutline && !existingDraftLoaded) {
      handleGenerateDraft();
    }
  }, [outline, draft, isGenerating, isLoadingOutline, existingDraftLoaded, handleGenerateDraft]);

  const handleCheckVoice = useCallback(async () => {
    if (!draft.trim()) return;

    // Use the universal generate endpoint
    const result = await checkVoice({
      prompt_slug: "voice_checker",
      session_id: sessionId || undefined,
      variables: {
        content: draft,
      },
    });

    if (result) {
      setVoiceScore(result);
    }
  }, [draft, sessionId, checkVoice]);

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(draft);
  };

  const handleDownloadDraft = () => {
    const blob = new Blob([draft], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${outline?.title || "draft"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInsertReference = useCallback((reference: { title: string; url: string; quote?: string }) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Build the markdown to insert
    let markdown = "";
    if (reference.quote) {
      // Insert as a blockquote with link
      markdown = `\n\n> ${reference.quote}\n> \n> — [${reference.title}](${reference.url})\n\n`;
    } else {
      // Insert as a simple link
      markdown = `[${reference.title}](${reference.url})`;
    }

    // Insert at cursor position
    const newDraft = draft.slice(0, start) + markdown + draft.slice(end);
    setDraft(newDraft);

    // Focus textarea and set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      const newPos = start + markdown.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }, [draft]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  const handleBackToOutline = () => {
    const params = new URLSearchParams();
    if (sessionId) {
      params.set("session_id", sessionId);
    }
    router.push(`/outline?${params.toString()}`);
  };

  const handleGoToOutputs = () => {
    const params = new URLSearchParams();
    if (sessionId) {
      params.set("session_id", sessionId);
    }
    router.push(`/outputs?${params.toString()}`);
  };

  // Show loading while fetching outline from database
  if (isLoadingOutline) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Draft</h1>
          <p className="text-muted-foreground">
            Generate and edit your content draft.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-center">
              Loading outline data...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!outline) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Draft</h1>
          <p className="text-muted-foreground">
            Generate and edit your content draft.
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              {sessionId
                ? "No outline found for this session."
                : "No session found. Please start from the beginning."}
            </p>
            <Button onClick={handleBackToOutline}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {sessionId ? "Go to Outline" : "Start New Session"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayContent = isGenerating ? streamedContent : draft;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Draft</h1>
          <p className="text-muted-foreground">
            {outline.title}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBackToOutline}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {draft && (
            <>
              <Button variant="outline" onClick={handleCopyDraft}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" onClick={handleDownloadDraft}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button onClick={handleGoToOutputs}>
                Generate Outputs
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Draft Editor</CardTitle>
                <CardDescription>
                  Edit your generated draft or regenerate
                </CardDescription>
              </div>
              <Button
                onClick={handleGenerateDraft}
                disabled={isGenerating}
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                ref={textareaRef}
                value={displayContent}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                placeholder={isGenerating ? "Generating your draft..." : "Your draft will appear here..."}
                disabled={isGenerating}
              />

              {displayContent && (
                <p className="text-sm text-muted-foreground mt-2">
                  {displayContent.split(/\s+/).filter(Boolean).length} words
                </p>
              )}

              {error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4 mt-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Voice Score Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Voice Check
              </CardTitle>
              <CardDescription>
                Analyze your draft against voice guidelines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleCheckVoice}
                disabled={isCheckingVoice || !draft.trim()}
                className="w-full"
              >
                {isCheckingVoice ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Check Voice
                  </>
                )}
              </Button>

              {voiceScore && (
                <>
                  <Separator />

                  {/* Overall Score */}
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(voiceScore.overall_score)}`}>
                      {voiceScore.overall_score}
                    </div>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                  </div>

                  {/* Individual Scores */}
                  <div className="space-y-3">
                    {Object.entries(voiceScore.scores).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{key}</span>
                          <span className={getScoreColor(value)}>{value}</span>
                        </div>
                        <Progress value={value} className="h-2" />
                      </div>
                    ))}
                  </div>

                  {/* Strengths */}
                  {voiceScore.strengths.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Strengths
                        </h4>
                        <ul className="space-y-1">
                          {voiceScore.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-muted-foreground">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                  {/* Warnings */}
                  {voiceScore.warnings.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          Issues
                        </h4>
                        <ul className="space-y-1">
                          {voiceScore.warnings.map((w, i) => (
                            <li key={i} className="text-sm text-muted-foreground">
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                  {/* Suggestions */}
                  {voiceScore.suggestions.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4 text-blue-600" />
                          Suggestions
                        </h4>
                        <ul className="space-y-1">
                          {voiceScore.suggestions.map((s, i) => (
                            <li key={i} className="text-sm text-muted-foreground">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Outline Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Outline Reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{outline.title}</p>
              <p className="text-sm text-muted-foreground">{outline.subtitle}</p>
              <Separator />
              <ul className="space-y-1">
                {outline.sections.map((section, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    {i + 1}. {section.title}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Cross-Reference Panel */}
          <CrossReferencePanel
            context={outline.title}
            onInsertReference={handleInsertReference}
          />
        </div>
      </div>
    </div>
  );
}
