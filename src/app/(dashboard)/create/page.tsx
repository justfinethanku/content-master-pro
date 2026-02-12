"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, Brain, Lightbulb, ArrowRight, Check, BookOpen } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { useGenerateJSON } from "@/hooks/use-generate";

interface ExtractedTheme {
  theme: string;
  description: string;
  potential_angles: string[];
  related_topics: string[];
}

interface BrainDumpResult {
  themes: ExtractedTheme[];
  key_insights: string[];
  suggested_research_queries: string[];
  overall_direction: string;
}

interface ParseResponse {
  success: boolean;
  result: BrainDumpResult;
  tokens: {
    input: number;
    output: number;
  };
}

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get("session_id");

  const [content, setContent] = useState("");
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [result, setResult] = useState<BrainDumpResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Use the new universal generate hook
  const { generateJSON, isLoading: isProcessing, error: generateError } = useGenerateJSON<BrainDumpResult>();

  // Track save errors separately so user knows when persistence fails
  const [saveError, setSaveError] = useState<string | null>(null);
  const error = saveError || generateError?.message || null;

  // Selection state for research items
  const [selectedThemes, setSelectedThemes] = useState<Set<number>>(new Set());
  const [selectedQueries, setSelectedQueries] = useState<Set<number>>(new Set());
  const [selectedInsights, setSelectedInsights] = useState<Set<number>>(new Set());

  // Skip research option (for opinion pieces)
  const [skipResearch, setSkipResearch] = useState(false);

  // Track whether selections were loaded from database (to prevent auto-select override)
  const [selectionsLoaded, setSelectionsLoaded] = useState(false);

  // Load existing session if session_id is in URL
  useEffect(() => {
    async function loadExistingSession() {
      if (!sessionIdFromUrl) return;

      setIsLoadingSession(true);
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("content_sessions")
          .select(`
            *,
            content_brain_dumps(raw_content, extracted_themes, user_selections)
          `)
          .eq("id", sessionIdFromUrl)
          .single();

        if (fetchError) {
          console.error("Failed to load session:", fetchError);
          return;
        }

        if (data) {
          setSessionId(data.id);

          const brainDump = data.content_brain_dumps?.[0];
          if (brainDump) {
            // Load the raw content
            if (brainDump.raw_content) {
              setContent(brainDump.raw_content);
            }

            // Load the extracted themes
            if (brainDump.extracted_themes) {
              setResult(brainDump.extracted_themes);
            }

            // Load user selections if they exist
            if (brainDump.user_selections) {
              const selections = brainDump.user_selections as {
                selected_theme_indices?: number[];
                selected_query_indices?: number[];
                selected_insight_indices?: number[];
                skip_research?: boolean;
              };
              if (selections.selected_theme_indices) {
                setSelectedThemes(new Set(selections.selected_theme_indices));
              }
              if (selections.selected_query_indices) {
                setSelectedQueries(new Set(selections.selected_query_indices));
              }
              if (selections.selected_insight_indices) {
                setSelectedInsights(new Set(selections.selected_insight_indices));
              }
              if (selections.skip_research !== undefined) {
                setSkipResearch(selections.skip_research);
              }
              setSelectionsLoaded(true);
            }
          }
        }
      } catch (err) {
        console.error("Error loading session:", err);
      } finally {
        setIsLoadingSession(false);
      }
    }

    loadExistingSession();
  }, [sessionIdFromUrl]);

  // Auto-select first theme and first 2 queries when results come in (only if not loaded from DB)
  useEffect(() => {
    if (result && !selectionsLoaded) {
      setSelectedThemes(new Set([0])); // Select first theme
      setSelectedQueries(new Set(result.suggested_research_queries.slice(0, 2).map((_, i) => i)));
      setSelectedInsights(new Set()); // Insights are optional, start unselected
    }
  }, [result, selectionsLoaded]);

  const toggleTheme = (idx: number) => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleQuery = (idx: number) => {
    setSelectedQueries((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleInsight = (idx: number) => {
    setSelectedInsights((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const totalSelected = selectedThemes.size + selectedQueries.size + selectedInsights.size;

  const handleParse = useCallback(async () => {
    if (!content.trim()) return;

    // Clear previous errors
    setSaveError(null);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return;
    }

    let activeSessionId = sessionId;

    // Only create a new session if we don't already have one
    if (!activeSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from("content_sessions")
        .insert({
          user_id: session.user.id,
          status: "brain_dump",
          title: content.trim().slice(0, 50) + (content.length > 50 ? "..." : ""),
        })
        .select()
        .single();

      if (sessionError) {
        console.error("Failed to create session:", sessionError);
        setSaveError(`Failed to create session: ${sessionError.message}`);
        return;
      }

      activeSessionId = newSession.id;
      setSessionId(newSession.id);
    } else {
      // Update the existing session title if content changed
      await supabase
        .from("content_sessions")
        .update({
          title: content.trim().slice(0, 50) + (content.length > 50 ? "..." : ""),
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeSessionId);
    }

    // Use the universal generate endpoint
    // Pass brain dump content directly since it's not yet saved to database
    const parsed = await generateJSON({
      prompt_slug: "brain_dump_parser",
      session_id: activeSessionId || undefined,
      variables: {
        brain_dump_raw_user: content.trim(),
      },
    });

    if (parsed) {
      setResult(parsed);

      // Check if brain dump exists for this session
      const { data: existingBrainDump } = await supabase
        .from("content_brain_dumps")
        .select("id")
        .eq("session_id", activeSessionId)
        .single();

      let brainDumpError;
      if (existingBrainDump) {
        // Update existing brain dump
        const { error } = await supabase
          .from("content_brain_dumps")
          .update({
            raw_content: content.trim(),
            extracted_themes: parsed,
          })
          .eq("session_id", activeSessionId);
        brainDumpError = error;
      } else {
        // Insert new brain dump
        const { error } = await supabase
          .from("content_brain_dumps")
          .insert({
            session_id: activeSessionId,
            raw_content: content.trim(),
            extracted_themes: parsed,
          });
        brainDumpError = error;
      }

      if (brainDumpError) {
        console.error("Failed to save brain dump:", brainDumpError);
        setSaveError(`Failed to save brain dump: ${brainDumpError.message}. Your work may not be preserved.`);
      } else {
        // Clear any previous save errors on success
        setSaveError(null);
      }
    }
  }, [content, sessionId, generateJSON]);

  const handleContinue = async () => {
    if (!result || (!skipResearch && totalSelected === 0)) return;

    // Gather selected items
    const selectedThemeData = result.themes.filter((_, idx) => selectedThemes.has(idx));
    const selectedQueryData = result.suggested_research_queries.filter((_, idx) => selectedQueries.has(idx));
    const selectedInsightData = result.key_insights.filter((_, idx) => selectedInsights.has(idx));

    // Save selections to database
    if (sessionId) {
      const supabase = createClient();
      const { error: selectionsError } = await supabase
        .from("content_brain_dumps")
        .update({
          user_selections: {
            selected_theme_indices: Array.from(selectedThemes),
            selected_query_indices: Array.from(selectedQueries),
            selected_insight_indices: Array.from(selectedInsights),
            skip_research: skipResearch,
          },
        })
        .eq("session_id", sessionId);

      if (selectionsError) {
        console.error("Failed to save selections:", selectionsError);
        // Don't block navigation, but warn the user
        setSaveError(`Warning: Selections may not be saved. ${selectionsError.message}`);
      }
    }

    // Store in sessionStorage for cleaner URL
    sessionStorage.setItem(
      "research_context",
      JSON.stringify({
        themes: selectedThemeData,
        queries: selectedQueryData,
        insights: selectedInsightData,
        overallDirection: result.overall_direction,
      })
    );

    // Navigate based on skip research choice
    const params = new URLSearchParams();
    if (sessionId) {
      params.set("session_id", sessionId);
    }

    if (skipResearch) {
      // Skip research - go directly to outline
      params.set("from_brain_dump", "true");
      router.push(`/outline?${params.toString()}`);
    } else {
      // Normal flow - go to research
      params.set("from_brain_dump", "true");
      router.push(`/research?${params.toString()}`);
    }
  };

  // Show loading state when loading existing session
  if (isLoadingSession) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Content</h1>
          <p className="text-muted-foreground">
            Loading existing session...
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-center">
              Loading your brain dump...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Content</h1>
        <p className="text-muted-foreground">
          {sessionId
            ? "Continue working on your brain dump and ideas."
            : "Start with a brain dump and let AI help you structure your ideas."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Brain Dump Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Brain Dump
            </CardTitle>
            <CardDescription>
              Write freely about your ideas, thoughts, and concepts. Don't worry about structure - just get it all out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Start typing your ideas here...

For example:
- What's been on your mind lately?
- Any interesting observations or experiences?
- Topics you want to explore?
- Arguments or perspectives you want to share?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[300px] resize-none"
              disabled={isProcessing}
            />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {content.length} characters
              </p>
              <Button
                onClick={handleParse}
                disabled={isProcessing || !content.trim()}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract Themes
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

        {/* Results Panel */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Overall Direction */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Overall Direction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{result.overall_direction}</p>
                </CardContent>
              </Card>

              {/* Extracted Themes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Themes</CardTitle>
                  <CardDescription>
                    Select themes to research together
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.themes.map((theme, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleTheme(idx)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedThemes.has(idx)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selectedThemes.has(idx)
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {selectedThemes.has(idx) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium">{theme.theme}</h4>
                          <p className="text-sm text-muted-foreground">{theme.description}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {theme.potential_angles.map((angle, aIdx) => (
                              <Badge key={aIdx} variant="secondary" className="text-xs">
                                {angle}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Suggested Research Queries */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Research Queries</CardTitle>
                  <CardDescription>
                    Add to your research
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.suggested_research_queries.map((query, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleQuery(idx)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                        selectedQueries.has(idx)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedQueries.has(idx)
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {selectedQueries.has(idx) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="text-sm">{query}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Key Insights (optional context) */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Key Insights</CardTitle>
                  <CardDescription>
                    Optional - include as context for research
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.key_insights.map((insight, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleInsight(idx)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                        selectedInsights.has(idx)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedInsights.has(idx)
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {selectedInsights.has(idx) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{insight}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Selection Summary & Continue Button */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Themes selected</span>
                      <Badge variant="secondary">{selectedThemes.size}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Queries selected</span>
                      <Badge variant="secondary">{selectedQueries.size}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Insights included</span>
                      <Badge variant="secondary">{selectedInsights.size}</Badge>
                    </div>
                    <Separator />

                    {/* Skip Research Option */}
                    <div className="flex items-start space-x-3 py-2">
                      <Checkbox
                        id="skip-research"
                        checked={skipResearch}
                        onCheckedChange={(checked) => setSkipResearch(checked === true)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="skip-research"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Skip research (opinion piece)
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Go directly to outline without gathering research
                        </p>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleContinue}
                      disabled={!skipResearch && totalSelected === 0}
                    >
                      {skipResearch ? (
                        <>
                          <BookOpen className="mr-2 h-4 w-4" />
                          Continue to Outline
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      ) : totalSelected === 0 ? (
                        "Select items to continue"
                      ) : (
                        <>
                          Continue to Research ({totalSelected} selected)
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground text-center">
                  Write your brain dump and click "Extract Themes" to see AI-powered analysis
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
