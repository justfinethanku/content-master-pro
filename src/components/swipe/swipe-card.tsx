"use client";

import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChangelogItem } from "@/hooks/use-changelog-items";

interface SwipeCardProps {
  item: ChangelogItem;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isTop: boolean;
}

export function SwipeCard({
  item,
  onSwipeLeft,
  onSwipeRight,
  isTop,
}: SwipeCardProps) {
  const x = useMotionValue(0);

  // Transform x position into rotation and opacity for visual feedback
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const leftOpacity = useTransform(x, [-100, 0], [1, 0]);
  const rightOpacity = useTransform(x, [0, 100], [0, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 100;

    if (info.offset.x > threshold) {
      onSwipeRight();
    } else if (info.offset.x < -threshold) {
      onSwipeLeft();
    }
  };

  const impactColors = {
    minor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    major: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    breaking: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <motion.div
      className="absolute inset-0 touch-none"
      style={{ x, rotate, zIndex: isTop ? 10 : 0 }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.5 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.5 }}
      exit={{ x: 300, opacity: 0, transition: { duration: 0.2 } }}
    >
      <div className="relative h-full w-full rounded-2xl bg-card border shadow-lg overflow-hidden">
        {/* Swipe indicators */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-red-500/20 rounded-2xl"
          style={{ opacity: leftOpacity }}
        >
          <span className="text-4xl font-bold text-red-500 -rotate-12">
            SKIP
          </span>
        </motion.div>
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-2xl"
          style={{ opacity: rightOpacity }}
        >
          <span className="text-4xl font-bold text-green-500 rotate-12">
            SAVE
          </span>
        </motion.div>

        {/* Card content */}
        <div className="relative h-full p-6 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground">
              {item.source_name}
            </span>
            <Badge variant="outline" className={impactColors[item.impact_level]}>
              {item.impact_level}
            </Badge>
          </div>

          {/* Headline */}
          <h2 className="text-xl font-semibold text-foreground mb-3 leading-tight">
            {item.headline}
          </h2>

          {/* Summary */}
          <p className="text-muted-foreground flex-1 leading-relaxed">
            {item.summary}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 mt-auto border-t">
            <span className="text-xs text-muted-foreground">
              {item.published_at
                ? new Date(item.published_at).toLocaleDateString()
                : "Recent"}
            </span>
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View source <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
