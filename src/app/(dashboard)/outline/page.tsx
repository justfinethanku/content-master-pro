"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  FileText,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  Users,
  MessageSquare,
  List,
  Lightbulb,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGenerateJSON } from "@/hooks/use-generate";

interface OutlineSection {
  title: string;
  key_points: string[];
  estimated_words: number;
  hook?: string;
}

interface Outline {
  title: string;
  subtitle: string;
  hook: string;
  target_audience: string;
  main_argument: string;
  sections: OutlineSection[];
  conclusion_approach: string;
  call_to_action?: string;
  estimated_total_words: number;
  tone_notes: string;
}

interface OutlineResponse {
  outline: Outline;
  summary: string;
  alternative_angles: string[];
}

interface ResearchData {
  theme: string;
  key_points: string[];
  data_points: string[];
  summary?: string;
  userNotes?: string;
  rawBrainDump?: string;
}

// Helper: Extract key points from research text (same logic as Edge Function)
function extractKeyPoints(content: string): string[] {
  const lines = content.split("\n");
  const keyPoints: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("- ") ||
      trimmed.startsWith("• ") ||
      trimmed.startsWith("* ") ||
      /^\d+\.\s/.test(trimmed)
    ) {
      const point = trimmed.replace(/^[-•*\d.]\s*/, "").trim();
      if (point.length > 10 && point.length < 300) {
        keyPoints.push(point);
      }
    }
  }

  return keyPoints.slice(0, 10);
}

// Helper: Extract data points from research text (same logic as Edge Function)
function extractDataPoints(content: string): string[] {
  const dataPoints: string[] = [];
  const sentences = content.split(/[.!]\s/);

  for (const sentence of sentences) {
    if (
      /\d+%/.test(sentence) ||
      /\$[\d,]+/.test(sentence) ||
      /\d{4}/.test(sentence) ||
      /\d+\s*(million|billion|thousand)/i.test(sentence)
    ) {
      const cleaned = sentence.trim();
      if (cleaned.length > 20 && cleaned.length < 250) {
        dataPoints.push(cleaned);
      }
    }
  }

  return dataPoints.slice(0, 8);
}

export default function OutlinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const themeFromUrl = searchParams.get("theme");

  const [research, setResearch] = useState<ResearchData | null>(null);
  const [isLoadingResearch, setIsLoadingResearch] = useState(true);
  const [result, setResult] = useState<OutlineResponse | null>(null);
  const [userInput, setUserInput] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  // Use the universal generate hook
  const { generateJSON, isLoading, error: generateError } = useGenerateJSON<OutlineResponse>();
  const error = loadError || generateError?.message || null;

  // Load research data from database using session_id
  useEffect(() => {
    async function loadResearch() {
      if (!sessionId) {
        setIsLoadingResearch(false);
        return;
      }

      try {
        const supabase = createClient();

        // Fetch research for this session (including user notes)
        const { data: researchData, error: researchError } = await supabase
          .from("content_research")
          .select("query, response, sources, user_notes")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (researchError) {
          console.error("Failed to load research:", researchError);
          setLoadError("Failed to load research data");
          setIsLoadingResearch(false);
          return;
        }

        // Also fetch brain dump for raw content
        const { data: brainDumpData } = await supabase
          .from("content_brain_dumps")
          .select("raw_content")
          .eq("session_id", sessionId)
          .single();

        // Check sessionStorage for outline_context (set by research page)
        let sessionUserNotes = "";
        let sessionRawBrainDump = "";
        const storedContext = sessionStorage.getItem("outline_context");
        if (storedContext) {
          try {
            const context = JSON.parse(storedContext);
            sessionUserNotes = context.userNotes || "";
            sessionRawBrainDump = context.rawBrainDump || "";
            // Clear after reading
            sessionStorage.removeItem("outline_context");
          } catch {
            console.error("Failed to parse outline_context");
          }
        }

        if (researchData) {
          // Re-extract key_points and data_points from the stored response
          const keyPoints = extractKeyPoints(researchData.response);
          const dataPoints = extractDataPoints(researchData.response);

          setResearch({
            theme: researchData.query || themeFromUrl || "",
            key_points: keyPoints,
            data_points: dataPoints,
            summary: researchData.response,
            // Prefer database values, fall back to sessionStorage
            userNotes: researchData.user_notes || sessionUserNotes || "",
            rawBrainDump: brainDumpData?.raw_content || sessionRawBrainDump || "",
          });
        }

        // Check for existing outline (for resume functionality)
        const { data: existingOutline } = await supabase
          .from("content_outlines")
          .select("outline_json, user_feedback")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existingOutline?.outline_json) {
          // Validate outline structure before setting
          const loadedOutline = existingOutline.outline_json as Outline;
          if (loadedOutline && loadedOutline.title && loadedOutline.sections) {
            setResult({
              outline: loadedOutline,
              summary: "",
              alternative_angles: [],
            });
            setExpandedSections(new Set([0]));
            if (existingOutline.user_feedback) {
              setUserInput(existingOutline.user_feedback);
            }
          } else {
            console.warn("Existing outline has invalid structure:", existingOutline.outline_json);
          }
        }
      } catch (err) {
        console.error("Error loading research:", err);
        setLoadError("Failed to load research data");
      } finally {
        setIsLoadingResearch(false);
      }
    }

    loadResearch();
  }, [sessionId, themeFromUrl]);

  const handleGenerateOutline = useCallback(async () => {
    if (!research) return;

    // Clear any previous errors
    setLoadError(null);

    // Use the universal generate endpoint
    // Most variables are auto-resolved from database using session_id
    // Only pass runtime user input that isn't yet saved
    const parsed = await generateJSON({
      prompt_slug: "outline_generator",
      session_id: sessionId || undefined,
      variables: {
        // Runtime user input (not yet saved to database)
        outline_preferences_user: userInput.trim() || "No specific preferences provided.",
      },
    });

    // Handle null/undefined - error is available via generateError from hook
    if (!parsed) {
      // The hook already set the error, but we can also set a fallback
      // The error will display via the `error` computed value (loadError || generateError?.message)
      return;
    }

    // Handle both response formats:
    // 1. { outline: {...}, summary: "...", alternative_angles: [...] }
    // 2. Direct outline object { title: "...", sections: [...], ... }
    let normalizedResult: OutlineResponse;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawParsed = parsed as any;

    if (rawParsed.outline && rawParsed.outline.title) {
      // Response has nested outline property
      normalizedResult = parsed;
    } else if (rawParsed.title && rawParsed.sections) {
      // Response IS the outline directly (AI returned outline without wrapper)
      normalizedResult = {
        outline: rawParsed as Outline,
        summary: "",
        alternative_angles: [],
      };
    } else {
      console.error("Invalid outline response structure:", parsed);
      setLoadError("Received invalid outline format. Please try again.");
      return;
    }

    setResult(normalizedResult);

    // Expand first section by default
    setExpandedSections(new Set([0]));

    // Save outline and update session status
    if (sessionId) {
      const supabase = createClient();

      // Check if outline exists for this session
      const { data: existingOutline } = await supabase
        .from("content_outlines")
        .select("id")
        .eq("session_id", sessionId)
        .single();

      let outlineError;
      if (existingOutline) {
        // Update existing outline
        const { error } = await supabase
          .from("content_outlines")
          .update({
            outline_json: normalizedResult.outline,
            user_feedback: userInput.trim() || null,
            selected: true,
          })
          .eq("session_id", sessionId);
        outlineError = error;
      } else {
        // Insert new outline
        const { error } = await supabase
          .from("content_outlines")
          .insert({
            session_id: sessionId,
            outline_json: normalizedResult.outline,
            user_feedback: userInput.trim() || null,
            selected: true,
          });
        outlineError = error;
      }

      if (outlineError) {
        console.error("Failed to save outline:", outlineError);
      }

      // Update session status to 'outline'
      await supabase
        .from("content_sessions")
        .update({ status: "outline" })
        .eq("id", sessionId);
    }
  }, [research, userInput, sessionId, generateJSON]);

  // Auto-generate on mount if research is available (wait for research to load)
  useEffect(() => {
    if (research && !result && !isLoading && !isLoadingResearch) {
      handleGenerateOutline();
    }
  }, [research, result, isLoading, isLoadingResearch, handleGenerateOutline]);

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleContinueToDraft = () => {
    if (!result) return;

    // Navigate to draft with session_id in URL (outline is saved in database)
    const params = new URLSearchParams();
    if (sessionId) {
      params.set("session_id", sessionId);
    }
    router.push(`/draft?${params.toString()}`);
  };

  const handleBackToResearch = () => {
    const params = new URLSearchParams();
    if (sessionId) {
      params.set("session_id", sessionId);
    }
    router.push(`/research?${params.toString()}`);
  };

  // Show loading while fetching research from database
  if (isLoadingResearch) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outline</h1>
          <p className="text-muted-foreground">
            Create a detailed outline for your content.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-center">
              Loading research data...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!research) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outline</h1>
          <p className="text-muted-foreground">
            Create a detailed outline for your content.
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              {sessionId
                ? "No research data found for this session."
                : "No session found. Please start from the beginning."}
            </p>
            <Button onClick={handleBackToResearch}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {sessionId ? "Go to Research" : "Start New Session"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outline</h1>
          <p className="text-muted-foreground">
            Review and refine your content outline before drafting.
          </p>
        </div>
        <Button variant="outline" onClick={handleBackToResearch}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Research
        </Button>
      </div>

      {/* Research Context */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Research Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="font-medium">{research.theme}</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{research.key_points.length} key points</Badge>
              <Badge variant="secondary">{research.data_points.length} data points</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modification Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Refine the Outline
          </CardTitle>
          <CardDescription>
            Add any specific requests or modifications for the outline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="e.g., Focus more on practical examples, make it shorter, add a controversial angle..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className="min-h-[80px]"
            disabled={isLoading}
          />

          <div className="flex justify-end">
            <Button
              onClick={handleGenerateOutline}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : result ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate Outline
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Outline
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outline Results */}
      {result && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Outline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Hook */}
            <Card>
              <CardHeader>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">{result.outline.title}</h2>
                  <p className="text-lg text-muted-foreground">{result.outline.subtitle}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Opening Hook</h3>
                  <p className="text-foreground italic">{result.outline.hook}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Main Argument
                  </h3>
                  <p className="text-foreground">{result.outline.main_argument}</p>
                </div>
              </CardContent>
            </Card>

            {/* Sections */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Sections
                </CardTitle>
                <CardDescription>
                  Click to expand section details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.outline.sections.map((section, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border"
                    >
                      <button
                        onClick={() => toggleSection(idx)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-medium">
                            {idx + 1}
                          </span>
                          <span className="font-medium">{section.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            ~{section.estimated_words} words
                          </Badge>
                          {expandedSections.has(idx) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {expandedSections.has(idx) && (
                        <div className="px-4 pb-4 space-y-3">
                          <Separator />

                          {section.hook && (
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-1">Section Hook</h4>
                              <p className="text-sm italic">{section.hook}</p>
                            </div>
                          )}

                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Key Points</h4>
                            <ul className="space-y-1">
                              {section.key_points.map((point, pointIdx) => (
                                <li key={pointIdx} className="text-sm flex items-start gap-2">
                                  <span className="text-primary mt-1">•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Conclusion */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conclusion Approach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-foreground">{result.outline.conclusion_approach}</p>

                {result.outline.call_to_action && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Call to Action</h3>
                      <p className="text-foreground">{result.outline.call_to_action}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Outline Meta */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Outline Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated words</span>
                  <Badge variant="secondary">{result.outline.estimated_total_words}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sections</span>
                  <Badge variant="secondary">{result.outline.sections.length}</Badge>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Target Audience
                  </h4>
                  <p className="text-sm">{result.outline.target_audience}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Tone Notes</h4>
                  <p className="text-sm">{result.outline.tone_notes}</p>
                </div>
              </CardContent>
            </Card>

            {/* Alternative Angles */}
            {result.alternative_angles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Alternative Angles
                  </CardTitle>
                  <CardDescription>
                    Other ways to approach this topic
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.alternative_angles.map((angle, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">→</span>
                        <span>{angle}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Summary & Action */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{result.summary}</p>

                <Separator />

                <Button
                  className="w-full"
                  onClick={handleContinueToDraft}
                >
                  Continue to Draft
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !result && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-center">
              Generating your outline...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
