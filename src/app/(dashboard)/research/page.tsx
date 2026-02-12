"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Search,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Quote,
  X,
  Brain,
  History,
  CheckCircle,
  AlertCircle,
  Edit,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGenerate } from "@/hooks/use-generate";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Types for past research
interface PastResearchResult {
  id: string;
  score: number;
  query: string;
  contentPreview: string;
  sessionId: string;
  createdAt: string;
  wordCount: number;
}

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
  const [rawBrainDump, setRawBrainDump] = useState<string | null>(null);

  const [theme, setTheme] = useState(initialTheme);
  const [additionalContext, setAdditionalContext] = useState(initialDescription);
  const [researchContent, setResearchContent] = useState<string | null>(null);
  const [citations, setCitations] = useState<string[]>([]);

  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Past research state
  const [pastResearch, setPastResearch] = useState<PastResearchResult[]>([]);
  const [isLoadingPastResearch, setIsLoadingPastResearch] = useState(false);
  const [selectedPastResearch, setSelectedPastResearch] = useState<string | null>(null);

  // Save status
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // User commentary/notes on research
  const [userNotes, setUserNotes] = useState<string>("");
  const [notesSaveStatus, setNotesSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Use the universal generate hook (returns markdown, not JSON)
  const { generate, isLoading, error: generateError } = useGenerate();
  const error = generateError?.message || null;

  // Load existing research AND brain dump context from database when resuming a session
  useEffect(() => {
    async function loadExistingSession() {
      if (!sessionId || fromBrainDump) return;

      setIsLoadingExisting(true);
      try {
        const supabase = createClient();

        // Load existing research
        const { data: existingResearch, error: researchError } = await supabase
          .from("content_research")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (researchError && researchError.code !== "PGRST116") {
          console.error("Failed to load existing research:", researchError);
        }

        if (existingResearch) {
          setTheme(existingResearch.query || "");
          setResearchContent(String(existingResearch.response));
          setCitations(existingResearch.sources || []);
          // Load user notes/commentary if saved
          if (existingResearch.user_notes) {
            setUserNotes(existingResearch.user_notes);
          }
        }

        // ALSO load brain dump context from database (for session resume)
        const { data: brainDump, error: brainDumpError } = await supabase
          .from("content_brain_dumps")
          .select("raw_content, extracted_themes, user_selections")
          .eq("session_id", sessionId)
          .single();

        if (brainDumpError && brainDumpError.code !== "PGRST116") {
          console.error("Failed to load brain dump context:", brainDumpError);
        }

        // Store raw brain dump content
        if (brainDump?.raw_content) {
          setRawBrainDump(brainDump.raw_content);
        }

        if (brainDump?.extracted_themes && brainDump?.user_selections) {
          const extracted = brainDump.extracted_themes as {
            themes: BrainDumpTheme[];
            key_insights: string[];
            suggested_research_queries: string[];
            overall_direction: string;
          };
          const selections = brainDump.user_selections as {
            selected_theme_indices: number[];
            selected_query_indices: number[];
            selected_insight_indices: number[];
          };

          // Restore selected items based on saved indices
          const selectedThemes = selections.selected_theme_indices
            .map((idx) => extracted.themes[idx])
            .filter(Boolean);
          const selectedQueries = selections.selected_query_indices
            .map((idx) => extracted.suggested_research_queries[idx])
            .filter(Boolean);
          const selectedInsights = selections.selected_insight_indices
            .map((idx) => extracted.key_insights[idx])
            .filter(Boolean);

          // Set context state
          setContextThemes(selectedThemes);
          setContextQueries(selectedQueries);
          setContextInsights(selectedInsights);
          setBrainDumpContext({
            themes: selectedThemes,
            queries: selectedQueries,
            insights: selectedInsights,
            overallDirection: extracted.overall_direction,
          });

          // If no existing research query, build from brain dump
          if (!existingResearch) {
            const themeNames = selectedThemes.map((t) => t.theme).join(", ");
            setTheme(themeNames);

            const contextParts = [];
            if (extracted.overall_direction) {
              contextParts.push(`Overall direction: ${extracted.overall_direction}`);
            }
            if (selectedInsights.length > 0) {
              contextParts.push(`Key insights: ${selectedInsights.join("; ")}`);
            }
            setAdditionalContext(contextParts.join("\n\n"));
          }
        }
      } catch (err) {
        console.error("Error loading existing session:", err);
      } finally {
        setIsLoadingExisting(false);
      }
    }

    loadExistingSession();
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

  // Search for related past research when theme changes
  useEffect(() => {
    async function searchPastResearch() {
      // Only search if we have a theme and no existing research is loaded
      if (!theme.trim() || researchContent) return;

      setIsLoadingPastResearch(true);
      try {
        const response = await fetch("/api/research/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            query: theme.trim(),
            topK: 5,
            minScore: 0.5,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setPastResearch(data.results || []);
        }
      } catch (err) {
        console.error("Failed to search past research:", err);
      } finally {
        setIsLoadingPastResearch(false);
      }
    }

    // Debounce the search
    const timeoutId = setTimeout(searchPastResearch, 500);
    return () => clearTimeout(timeoutId);
  }, [theme, researchContent]);

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

    setSaveStatus("idle");

    // Build rich context from brain dump data
    const themeDescriptions = contextThemes.length > 0
      ? contextThemes.map((t) => `**${t.theme}**: ${t.description}`).join("\n\n")
      : "No detailed theme descriptions available.";

    const researchQueries = contextQueries.length > 0
      ? contextQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")
      : "No specific research queries provided.";

    const insightsText = contextInsights.length > 0
      ? contextInsights.map((ins, i) => `${i + 1}. ${ins}`).join("\n")
      : "No key insights provided.";

    const overallDirection = brainDumpContext?.overallDirection || "No overall direction specified.";

    // Use the universal generate endpoint (returns markdown)
    // Model is controlled by database (research_generator → perplexity/sonar-pro)
    // Note: These variables are passed manually because they're filtered by user selections
    // (auto-resolution would get ALL items, not just selected ones)
    const result = await generate({
      prompt_slug: "research_generator",
      session_id: sessionId || undefined,
      variables: {
        // User's research query/topic
        research_query_user: theme.trim(),
        // Brain dump context (filtered by user selections)
        brain_dump_raw_user: rawBrainDump || "No original brain dump available.",
        brain_dump_theme_descriptions_ai: themeDescriptions,
        brain_dump_suggested_queries_ai: researchQueries,
        brain_dump_key_insights_ai: insightsText,
        brain_dump_overall_direction_ai: overallDirection,
        // Runtime user input (must match prompt template variable name)
        research_additional_context_user: additionalContext.trim() || "No additional context provided.",
      },
    });

    if (result?.success && result.content) {
      setResearchContent(result.content);
      setCitations(result.citations || []);

      // Update session status to 'research'
      if (sessionId) {
        const supabase = createClient();
        await supabase
          .from("content_sessions")
          .update({ status: "research" })
          .eq("id", sessionId);

        // Auto-save research to database
        setSaveStatus("saving");
        try {
          const { data: savedResearch, error: insertError } = await supabase
            .from("content_research")
            .insert({
              session_id: sessionId,
              query: theme.trim(),
              response: result.content,
              sources: result.citations || [],
              additional_context: additionalContext.trim() || null,
              pinecone_indexed: false,
            })
            .select("id")
            .single();

          if (insertError) {
            setSaveStatus("error");
            console.error("Failed to save research:", insertError);
          } else {
            setSaveStatus("saved");
            // Clear past research since we just did new research
            setPastResearch([]);

            // Trigger async Pinecone embedding via API (fire and forget)
            fetch("/api/research/embed", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                research_id: savedResearch.id,
                query: theme.trim(),
                response: result.content,
                session_id: sessionId,
              }),
            }).catch((err) => console.error("Pinecone embed error:", err));
          }
        } catch (err) {
          setSaveStatus("error");
          console.error("Error saving research:", err);
        }
      }
    }
  }, [theme, additionalContext, sessionId, generate, contextThemes, contextQueries, contextInsights, brainDumpContext, rawBrainDump]);

  // Save user notes to database (debounced auto-save)
  const saveNotes = useCallback(async (notes: string) => {
    if (!sessionId) return;

    setNotesSaveStatus("saving");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("content_research")
        .update({ user_notes: notes })
        .eq("session_id", sessionId);

      if (updateError) {
        console.error("Failed to save notes:", updateError);
        setNotesSaveStatus("error");
      } else {
        setNotesSaveStatus("saved");
      }
    } catch (err) {
      console.error("Error saving notes:", err);
      setNotesSaveStatus("error");
    }
  }, [sessionId]);

  // Debounced note saving
  useEffect(() => {
    if (!userNotes || !researchContent) return;

    const timeoutId = setTimeout(() => {
      saveNotes(userNotes);
    }, 1000); // Save 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [userNotes, researchContent, saveNotes]);

  // Load past research content into the page
  const handleUsePastResearch = useCallback(async (researchId: string) => {
    setSelectedPastResearch(researchId);
    setIsLoadingExisting(true);

    try {
      const supabase = createClient();
      const { data: research, error } = await supabase
        .from("content_research")
        .select("*")
        .eq("id", researchId)
        .single();

      if (error) {
        console.error("Failed to load past research:", error);
        return;
      }

      if (research) {
        setResearchContent(String(research.response));
        setCitations(research.sources || research.citations || []);
        setTheme(research.query || theme);
        // Clear past research suggestions
        setPastResearch([]);
      }
    } catch (err) {
      console.error("Error loading past research:", err);
    } finally {
      setIsLoadingExisting(false);
      setSelectedPastResearch(null);
    }
  }, [theme]);

  const handleContinueToOutline = () => {
    // Store research context for outline page (includes user notes)
    sessionStorage.setItem(
      "outline_context",
      JSON.stringify({
        research: researchContent,
        userNotes: userNotes,
        rawBrainDump: rawBrainDump,
        theme: theme,
      })
    );

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
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Selected from Brain Dump
                </CardTitle>
                <CardDescription>
                  Remove items you don't want to research, or edit the topic below
                </CardDescription>
              </div>
              {sessionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/create?session_id=${sessionId}`)}
                  className="shrink-0"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Selections
                </Button>
              )}
            </div>
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
              ) : researchContent ? (
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

      {/* Past Research Suggestions */}
      {pastResearch.length > 0 && !researchContent && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Related Past Research
            </CardTitle>
            <CardDescription>
              We found similar research you&apos;ve done before. Use it or start fresh.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pastResearch.map((research) => (
              <div
                key={research.id}
                className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{research.query}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {research.contentPreview}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{Math.round(research.score * 100)}% match</span>
                    <span>{research.wordCount} words</span>
                    <span>{new Date(research.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUsePastResearch(research.id)}
                  disabled={selectedPastResearch === research.id}
                >
                  {selectedPastResearch === research.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Use This"
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Loading Past Research Indicator */}
      {isLoadingPastResearch && !researchContent && theme.trim() && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching for related past research...
        </div>
      )}

      {/* Research Results */}
      {researchContent && (
        <div className="space-y-6">
          {/* Main content row: Research + Notes side by side */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Research Content - 3 columns */}
            <div className="lg:col-span-3">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Quote className="h-5 w-5" />
                      Research Results
                    </CardTitle>
                    {/* Save status indicator */}
                    {saveStatus === "saving" && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </div>
                    )}
                    {saveStatus === "saved" && (
                      <div className="flex items-center gap-1.5 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Saved to library
                      </div>
                    )}
                    {saveStatus === "error" && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        Failed to save
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2 prose-td:border prose-td:border-border prose-td:p-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{researchContent}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Notes Panel - 2 columns, sticky */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-4 space-y-4">
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Your Commentary
                      </CardTitle>
                      {/* Notes save status */}
                      {notesSaveStatus === "saving" && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </div>
                      )}
                      {notesSaveStatus === "saved" && (
                        <div className="flex items-center gap-1.5 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                      {notesSaveStatus === "error" && (
                        <div className="flex items-center gap-1.5 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <CardDescription>
                      Make notes on the research. These will be passed to the outline.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="What stands out to you? What angles do you want to pursue? Any counterarguments or personal takes?

Example notes:
• The stat about 73% adoption is compelling - lead with this
• I disagree with the expert on X - here's why...
• This connects to my experience when..."
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      className="min-h-[300px] resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {userNotes.length} characters • Auto-saves as you type
                    </p>
                  </CardContent>
                </Card>

                {/* Citations */}
                {citations.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Sources</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {citations.map((citation, idx) => (
                          <a
                            key={idx}
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="line-clamp-1">[{idx + 1}] {citation}</span>
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Continue Button */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleContinueToOutline}
                >
                  Continue to Outline
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
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
      {!researchContent && !isLoading && !isLoadingExisting && (
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
