"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { ChangelogItem } from "@/hooks/use-changelog-items";

interface CaptureModalProps {
  item: ChangelogItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (commentary: string) => void;
  isLoading?: boolean;
}

export function CaptureModal({
  item,
  open,
  onClose,
  onConfirm,
  isLoading,
}: CaptureModalProps) {
  const [commentary, setCommentary] = useState("");

  const handleConfirm = () => {
    if (commentary.trim()) {
      onConfirm(commentary.trim());
      setCommentary("");
    }
  };

  const handleClose = () => {
    setCommentary("");
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-lg">Add your take</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview of the item */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium text-foreground mb-1">
              {item.headline}
            </p>
            <p className="text-xs text-muted-foreground">{item.source_name}</p>
          </div>

          {/* Commentary input */}
          <Textarea
            placeholder="What's your reaction? Why does this matter?"
            value={commentary}
            onChange={(e) => setCommentary(e.target.value)}
            className="min-h-[120px] resize-none"
            autoFocus
          />

          <p className="text-xs text-muted-foreground">
            Tip: Use iOS keyboard dictation for quick capture
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!commentary.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
