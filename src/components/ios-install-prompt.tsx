"use client";

import { useState, useEffect } from "react";
import { X, Share, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if running on iOS Safari and not already installed as PWA
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    const isStandalone =
      "standalone" in window.navigator &&
      (window.navigator as unknown as { standalone: boolean }).standalone;
    const hasBeenDismissed = localStorage.getItem("ios-install-dismissed");

    if (isIOS && !isStandalone && !hasBeenDismissed) {
      // Delay showing the prompt
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("ios-install-dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-safe">
      <div className="bg-card border rounded-xl shadow-lg p-4 mx-auto max-w-sm">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-foreground">Install App</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2 -mt-1"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Install Content Master Pro on your home screen for the best
          experience.
        </p>
        <ol className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-center gap-2">
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-medium">
              1
            </span>
            <span>
              Tap <Share className="inline h-4 w-4 mx-1" /> Share
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-medium">
              2
            </span>
            <span>
              Tap <PlusSquare className="inline h-4 w-4 mx-1" /> Add to Home
              Screen
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
