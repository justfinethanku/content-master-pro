"use client";

import { useState } from "react";
import { useCaptures, useDeleteCapture } from "@/hooks/use-captures";
import { CaptureCard } from "@/components/captures/capture-card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, FileText } from "lucide-react";
import { useDebounce } from "use-debounce";

export default function CapturesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);

  const {
    data: captures,
    isLoading,
    error,
  } = useCaptures({ search: debouncedSearch });
  const deleteMutation = useDeleteCapture();

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Captures</h1>
        <p className="text-muted-foreground">
          Your saved updates with commentary
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search captures..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load captures</p>
        </div>
      ) : captures && captures.length > 0 ? (
        <div className="space-y-4">
          {captures.map((capture) => (
            <CaptureCard
              key={capture.id}
              capture={capture}
              onDelete={handleDelete}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-1">No captures yet</h3>
          <p className="text-sm text-muted-foreground">
            {search
              ? "No captures match your search"
              : "Swipe right on updates to save them here"}
          </p>
        </div>
      )}
    </div>
  );
}
