"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePublication } from "@/hooks/use-publications";
import { Plus, Loader2 } from "lucide-react";

const PLATFORMS = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "substack", label: "Substack" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter/X" },
  { value: "instagram", label: "Instagram" },
  { value: "other", label: "Other" },
];

interface PublicationModalProps {
  projectId: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function PublicationModal({
  projectId,
  onSuccess,
  trigger,
}: PublicationModalProps) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState(
    new Date().toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:mm
  );
  const [notes, setNotes] = useState("");

  const createPublication = useCreatePublication();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!platform) return;

    try {
      await createPublication.mutateAsync({
        project_id: projectId,
        platform,
        published_url: publishedUrl || undefined,
        published_at: new Date(publishedAt).toISOString(),
        metadata: notes ? { notes } : {},
      });

      // Reset form
      setPlatform("");
      setPublishedUrl("");
      setPublishedAt(new Date().toISOString().slice(0, 16));
      setNotes("");
      setOpen(false);

      onSuccess?.();
    } catch (error) {
      console.error("Failed to create publication:", error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setPlatform("");
      setPublishedUrl("");
      setPublishedAt(new Date().toISOString().slice(0, 16));
      setNotes("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Record Publication
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Publication</DialogTitle>
            <DialogDescription>
              Track where and when this content was published.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Platform */}
            <div className="grid gap-2">
              <Label htmlFor="platform">Platform *</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Published URL */}
            <div className="grid gap-2">
              <Label htmlFor="publishedUrl">Published URL</Label>
              <Input
                id="publishedUrl"
                type="url"
                placeholder="https://..."
                value={publishedUrl}
                onChange={(e) => setPublishedUrl(e.target.value)}
              />
            </div>

            {/* Published At */}
            <div className="grid gap-2">
              <Label htmlFor="publishedAt">Published At *</Label>
              <Input
                id="publishedAt"
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!platform || createPublication.isPending}
            >
              {createPublication.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Save Publication
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
