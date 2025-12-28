"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ExternalLink, MessageSquare, List, Loader2, Send, User, Bot, Trash2 } from "lucide-react";

interface SearchResult {
  id: string;
  score: number;
  title: string;
  subtitle?: string;
  author: string;
  source: string;
  url?: string;
  publishedAt?: string;
  contentPreview: string;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  count: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSources, setSelectedSources] = useState<("jon" | "nate")[]>(["jon", "nate"]);
  const [mode, setMode] = useState<"results" | "chat">("results");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState("");

  // Chat hook for AI-powered conversations
  const {
    messages,
    status,
    sendMessage,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/search/chat",
      body: {
        sources: selectedSources,
      },
    }),
  });

  const isChatLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const sourcesParam = selectedSources.join(",");
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}&sources=${sourcesParam}&topK=20`
      );
      const data = (await response.json()) as SearchResponse;
      setResults(data.results);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, selectedSources]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleSource = (source: "jon" | "nate") => {
    setSelectedSources((prev) => {
      if (prev.includes(source)) {
        // Don't allow deselecting all sources
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== source);
      }
      return [...prev, source];
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSourceColor = (source: string) => {
    if (source.includes("jon")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (source.includes("nate")) return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    return "bg-muted text-muted-foreground";
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Helper to get text content from message parts
  const getMessageText = (message: typeof messages[number]) => {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground">
          Search across Jon's and Nate's posts for relevant content and inspiration.
        </p>
      </div>

      {/* Source Filters - shown for both modes */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Sources:</span>
        <div className="flex gap-2">
          <Button
            variant={selectedSources.includes("jon") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleSource("jon")}
          >
            Jon's Posts (59)
          </Button>
          <Button
            variant={selectedSources.includes("nate") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleSource("nate")}
          >
            Nate's Posts (411)
          </Button>
        </div>
      </div>

      {/* Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "results" | "chat")}>
        <TabsList>
          <TabsTrigger value="results" className="gap-2">
            <List className="h-4 w-4" />
            Results View
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="mt-4">
          {/* Search Bar for Results Mode */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search for topics, ideas, or concepts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading || !query.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No results found for "{query}"</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found {results.length} results for "{query}"
              </p>
              {results.map((result) => (
                <Card key={result.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg line-clamp-2">
                          {result.title}
                        </CardTitle>
                        {result.subtitle && (
                          <CardDescription className="mt-1 line-clamp-1">
                            {result.subtitle}
                          </CardDescription>
                        )}
                      </div>
                      {result.url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="shrink-0"
                        >
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className={getSourceColor(result.source)}>
                        {result.author}
                      </Badge>
                      {result.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(result.publishedAt)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        Relevance: {Math.round(result.score * 100)}%
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {result.contentPreview}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !hasSearched ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Enter a search query to find relevant posts
              </p>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <Card className="flex flex-col h-[600px]">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Chat with your content</CardTitle>
                  <CardDescription>
                    Ask questions about Jon's and Nate's posts. AI will search and cite relevant content.
                  </CardDescription>
                </div>
                {messages.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearChat}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              {/* Messages Area */}
              <ScrollArea className="flex-1 pr-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">
                      Start a conversation about the newsletter content
                    </p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Try asking things like "What has Jon written about AI tools?" or
                      "What are Nate's best tips for product managers?"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 max-w-[80%] ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{getMessageText(message)}</p>
                        </div>
                        {message.role === "user" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <User className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input Area */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim() && !isChatLoading) {
                    sendMessage({ text: chatInput.trim() });
                    setChatInput("");
                  }
                }}
                className="flex gap-2 mt-4 shrink-0"
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question about the content..."
                  disabled={isChatLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={isChatLoading || !chatInput.trim()}>
                  {isChatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
