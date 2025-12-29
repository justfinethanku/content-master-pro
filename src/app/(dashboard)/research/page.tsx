"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Search,
  ExternalLink,
  Check,
  ArrowRight,
  RefreshCw,
  Lightbulb,
  Quote,
  BarChart3,
  HelpCircle,
  X,
  Brain,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGenerateJSON } from "@/hooks/use-generate";
import ReactMarkdown from "react-markdown";

interface BrainDumpTheme {
  theme: string;
  description: string;
  potential_angles: string[];
  related_topics: string[];
}

interface ResearchContext {
  themes: BrainDumpTheme[];
  queries: string[];
  insights: string[];
  overallDirection: string;
}

interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
}

interface ResearchResult {
  topic: string;
  summary: string;
  key_points: string[];
  sources: ResearchSource[];
  related_questions: string[];
  data_points: string[];
}

interface ResearchResponse {
  success: boolean;
  result: ResearchResult;
  tokens: {
    input: number;
    output: number;
  };
}

export default function ResearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTheme = searchParams.get("theme") || "";
  const initialDescription = searchParams.get("description") || "";
  const sessionId = searchParams.get("session_id");
  const fromBrainDump = searchParams.get("from_brain_dump") === "true";

  // Brain dump context state
  const [brainDumpContext, setBrainDumpContext] = useState<ResearchContext | null>(null);
  const [contextThemes, setContextThemes] = useState<BrainDumpTheme[]>([]);
  const [contextQueries, setContextQueries] = useState<string[]>([]);
  const [contextInsights, setContextInsights] = useState<string[]>([]);

  const [theme, setTheme] = useState(initialTheme);
  const [additionalContext, setAdditionalContext] = useState(initialDescription);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [selectedDataPoints, setSelectedDataPoints] = useState<Set<string>>(new Set());

  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Use the universal generate hook
  const { generateJSON, isLoading, error: generateError } = useGenerateJSON<ResearchResult>();
  const error = generateError?.message || null;

  // Load existing research from database when session_id present (and not from fresh brain dump)
  useEffect(() => {
    async function loadExistingResearch() {
      if (!sessionId || fromBrainDump) return;

      setIsLoadingExisting(true);
      try {
        const supabase = createClient();
        const { data: existingResearch, error } = await supabase
          .from("content_research")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 = no rows found, which is fine
          console.error("Failed to load existing research:", error);
        }

        if (existingResearch) {
          setTheme(existingResearch.query || "");

          // Parse the stored research response
          try {
            const parsedResult = typeof existingResearch.response === "string"
              ? JSON.parse(existingResearch.response)
              : existingResearch.response;

            // If response is structured with our expected fields, use it
            if (parsedResult && typeof parsedResult === "object") {
              setResult({
                topic: existingResearch.query || "",
                summary: parsedResult.summary || parsedResult.research_summary || String(existingResearch.response),
                key_points: parsedResult.key_points || [],
                sources: existingResearch.sources || parsedResult.sources || [],
                related_questions: parsedResult.related_questions || [],
                data_points: parsedResult.data_points || [],
              });

              // Auto-select all loaded points
              if (parsedResult.key_points) {
                setSelectedPoints(new Set(parsedResult.key_points));
              }
              if (parsedResult.data_points) {
                setSelectedDataPoints(new Set(parsedResult.data_points));
              }
            } else {
              // Fallback for plain text response
              setResult({
                topic: existingResearch.query || "",
                summary: String(existingResearch.response),
                key_points: [],
                sources: existingResearch.sources || [],
                related_questions: [],
                data_points: [],
              });
            }
          } catch {
            // If parsing fails, treat response as plain text summary
            setResult({
              topic: existingResearch.query || "",
              summary: String(existingResearch.response),
              key_points: [],
              sources: existingResearch.sources || [],
              related_questions: [],
              data_points: [],
            });
          }
        }
      } catch (err) {
        console.error("Error loading existing research:", err);
      } finally {
        setIsLoadingExisting(false);
      }
    }

    loadExistingResearch();
  }, [sessionId, fromBrainDump]);

  // Load brain dump context from sessionStorage
  useEffect(() => {
    if (fromBrainDump) {
      const stored = sessionStorage.getItem("research_context");
      if (stored) {
        try {
          const context: ResearchContext = JSON.parse(stored);
          setBrainDumpContext(context);
          setContextThemes(context.themes);
          setContextQueries(context.queries);
          setContextInsights(context.insights);

          // Build initial theme from selected items
          const themeNames = context.themes.map((t) => t.theme).join(", ");
          const queryText = context.queries.join("; ");
          setTheme(themeNames || queryText);

          // Build additional context from insights and overall direction
          const contextParts = [];
          if (context.overallDirection) {
            contextParts.push(`Overall direction: ${context.overallDirection}`);
          }
          if (context.insights.length > 0) {
            contextParts.push(`Key insights to consider: ${context.insights.join("; ")}`);
          }
          if (context.themes.length > 0) {
            const angles = context.themes.flatMap((t) => t.potential_angles).slice(0, 5);
            if (angles.length > 0) {
              contextParts.push(`Potential angles: ${angles.join(", ")}`);
            }
          }
          setAdditionalContext(contextParts.join("\n\n"));

          // Clear sessionStorage after loading
          sessionStorage.removeItem("research_context");
        } catch {
          console.error("Failed to parse research context");
        }
      }
    }
  }, [fromBrainDump]);

  const removeContextTheme = (idx: number) => {
    setContextThemes((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeContextQuery = (idx: number) => {
    setContextQueries((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeContextInsight = (idx: number) => {
    setContextInsights((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResearch = useCallback(async () => {
    if (!theme.trim()) return;

    // Use the universal generate endpoint
    const parsed = await generateJSON({
      prompt_slug: "research_generator",
      session_id: sessionId || undefined,
      variables: {
        content: theme.trim(),
        description: additionalContext.trim() || "",
      },
      overrides: {
        model_id: "perplexity/sonar-pro",
      },
    });

    if (parsed) {
      setResult(parsed);

      // Update session status to 'research'
      if (sessionId) {
        const supabase = createClient();
        await supabase
          .from("content_sessions")
          .update({ status: "research" })
          .eq("id", sessionId);
      }

      // Auto-select all key points and data points
      setSelectedPoints(new Set(parsed.key_points));
      setSelectedDataPoints(new Set(parsed.data_points));
    }
  }, [theme, additionalContext, sessionId, generateJSON]);

  const togglePoint = (point: string) => {
    setSelectedPoints((prev) => {
      const next = new Set(prev);
      if (next.has(point)) {
        next.delete(point);
      } else {
        next.add(point);
      }
      return next;
    });
  };

  const toggleDataPoint = (point: string) => {
    setSelectedDataPoints((prev) => {
      const next = new Set(prev);
      if (next.has(point)) {
        next.delete(point);
      } else {
        next.add(point);
      }
      return next;
    });
  };

  const handleContinueToOutline = () => {
    // Navigate to outline with session_id
    // The outline page will load research data from the database
    const params = new URLSearchParams();
    if (sessionId) {
      params.set("session_id", sessionId);
    }
    // Pass selected points as URL params (or they can be loaded from session)
    params.set("theme", theme);
    router.push(`/outline?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Research</h1>
        <p className="text-muted-foreground">
          Gather real-time research on your topic using AI-powered web search.
        </p>
      </div>

      {/* Brain Dump Context - shown when coming from Create page */}
      {(contextThemes.length > 0 || contextQueries.length > 0 || contextInsights.length > 0) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Selected from Brain Dump
            </CardTitle>
            <CardDescription>
              Remove items you don't want to research, or edit the topic below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Themes */}
            {contextThemes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Themes</p>
                <div className="flex flex-wrap gap-2">
                  {contextThemes.map((t, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {t.theme}
                      <button
                        onClick={() => removeContextTheme(idx)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Queries */}
            {contextQueries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Research Queries</p>
                <div className="flex flex-wrap gap-2">
                  {contextQueries.map((q, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="flex items-center gap-1 pr-1"
                    >
                      {q}
                      <button
                        onClick={() => removeContextQuery(idx)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {contextInsights.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Context Insights</p>
                <div className="space-y-1">
                  {contextInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-sm text-muted-foreground bg-background rounded p-2"
                    >
                      <span className="flex-1">{insight}</span>
                      <button
                        onClick={() => removeContextInsight(idx)}
                        className="hover:bg-muted rounded-full p-0.5 shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Research Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Research Topic
          </CardTitle>
          <CardDescription>
            {brainDumpContext
              ? "Edit the topic below or start researching with the selected items"
              : "Enter a topic and we'll gather current research, statistics, and perspectives."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
            <Textarea
              placeholder="e.g., The impact of AI on content creation workflows"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="min-h-[80px]"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Context (optional)</label>
            <Textarea
              placeholder="Any specific angles, questions, or aspects you want to explore..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              className="min-h-[60px]"
              disabled={isLoading}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleResearch}
              disabled={isLoading || !theme.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : result ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Research Again
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Start Research
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

      {/* Research Results */}
      {result && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Quote className="h-5 w-5" />
                  Research Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                  <ReactMarkdown>{result.summary}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            {/* Key Points */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Key Points
                </CardTitle>
                <CardDescription>
                  Click to select/deselect points to include in your outline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.key_points.map((point, idx) => (
                    <button
                      key={idx}
                      onClick={() => togglePoint(point)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                        selectedPoints.has(point)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedPoints.has(point)
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {selectedPoints.has(point) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="text-sm">{point}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data Points */}
            {result.data_points.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Statistics & Data
                  </CardTitle>
                  <CardDescription>
                    Numbers and facts to strengthen your argument
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.data_points.map((point, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleDataPoint(point)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                          selectedDataPoints.has(point)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <div
                          className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selectedDataPoints.has(point)
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {selectedDataPoints.has(point) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <span className="text-sm">{point}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Sources */}
            {result.sources.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="line-clamp-1">{source.title || source.url}</span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related Questions */}
            {result.related_questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Related Questions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.related_questions.map((question, idx) => (
                      <p key={idx} className="text-sm text-muted-foreground">
                        {question}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selection Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Key points selected</span>
                  <Badge variant="secondary">{selectedPoints.size}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Data points selected</span>
                  <Badge variant="secondary">{selectedDataPoints.size}</Badge>
                </div>

                <Separator />

                <Button
                  className="w-full"
                  onClick={handleContinueToOutline}
                  disabled={selectedPoints.size === 0}
                >
                  Continue to Outline
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Loading Existing Research State */}
      {isLoadingExisting && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-center">
              Loading existing research...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!result && !isLoading && !isLoadingExisting && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              Enter a topic above and click "Start Research" to gather real-time information
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
