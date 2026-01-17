"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { SwipeCard } from "./swipe-card";
import { CaptureModal } from "./capture-modal";
import { useDismissItem } from "@/hooks/use-changelog-items";
import { useCaptureItem } from "@/hooks/use-capture-item";
import type { ChangelogItem } from "@/hooks/use-changelog-items";
import { CheckCircle } from "lucide-react";

interface CardStackProps {
  items: ChangelogItem[];
  onItemProcessed?: () => void;
}

export function CardStack({ items, onItemProcessed }: CardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captureItem, setCaptureItem] = useState<ChangelogItem | null>(null);

  const dismissMutation = useDismissItem();
  const captureMutation = useCaptureItem();

  const currentItem = items[currentIndex];
  const nextItem = items[currentIndex + 1];

  const handleSwipeLeft = useCallback(() => {
    if (!currentItem) return;

    dismissMutation.mutate(currentItem.id, {
      onSuccess: () => {
        setCurrentIndex((prev) => prev + 1);
        onItemProcessed?.();
      },
    });
  }, [currentItem, dismissMutation, onItemProcessed]);

  const handleSwipeRight = useCallback(() => {
    if (!currentItem) return;
    setCaptureItem(currentItem);
  }, [currentItem]);

  const handleCapture = useCallback(
    (commentary: string) => {
      if (!captureItem) return;

      captureMutation.mutate(
        {
          changelog_item_id: captureItem.id,
          user_commentary: commentary,
        },
        {
          onSuccess: () => {
            setCaptureItem(null);
            setCurrentIndex((prev) => prev + 1);
            onItemProcessed?.();
          },
        }
      );
    },
    [captureItem, captureMutation, onItemProcessed]
  );

  const handleCloseModal = useCallback(() => {
    setCaptureItem(null);
  }, []);

  // All done state
  if (!currentItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          All caught up!
        </h2>
        <p className="text-muted-foreground">
          No more updates to review. Check back later for new items.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full h-full">
        <AnimatePresence mode="popLayout">
          {/* Show next card behind current */}
          {nextItem && (
            <SwipeCard
              key={nextItem.id}
              item={nextItem}
              onSwipeLeft={() => {}}
              onSwipeRight={() => {}}
              isTop={false}
            />
          )}

          {/* Current card on top */}
          <SwipeCard
            key={currentItem.id}
            item={currentItem}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            isTop={true}
          />
        </AnimatePresence>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center gap-8 text-sm text-muted-foreground">
        <span>← Skip</span>
        <span>Save →</span>
      </div>

      {/* Capture modal */}
      <CaptureModal
        item={captureItem}
        open={!!captureItem}
        onClose={handleCloseModal}
        onConfirm={handleCapture}
        isLoading={captureMutation.isPending}
      />
    </>
  );
}
