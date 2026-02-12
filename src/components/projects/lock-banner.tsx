"use client";

import { Button } from "@/components/ui/button";
import type { LockStatus } from "@/lib/types";
import { Lock, Unlock, AlertCircle, Loader2 } from "lucide-react";

interface LockBannerProps {
  lockStatus: LockStatus;
  onAcquireLock: () => void;
  onReleaseLock: () => void;
  isAcquiring?: boolean;
  isReleasing?: boolean;
}

export function LockBanner({
  lockStatus,
  onAcquireLock,
  onReleaseLock,
  isAcquiring = false,
  isReleasing = false,
}: LockBannerProps) {
  const { isLocked, isLockedByCurrentUser, lockedAt } = lockStatus;

  // Format lock time
  const formatLockTime = (timestamp: string | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Not locked - show edit button (left) and status (right)
  if (!isLocked) {
    return (
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
        <Button
          size="sm"
          onClick={onAcquireLock}
          disabled={isAcquiring}
        >
          {isAcquiring ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-1" />
              Edit
            </>
          )}
        </Button>
        <div className="flex items-center gap-2">
          <Unlock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Click Edit to start editing this asset
          </span>
        </div>
      </div>
    );
  }

  // Locked by current user - button (left) and status (right)
  if (isLockedByCurrentUser) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
        <Button
          size="sm"
          variant="outline"
          onClick={onReleaseLock}
          disabled={isReleasing}
          className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
        >
          {isReleasing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Finishing...
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4 mr-1" />
              Done Editing
            </>
          )}
        </Button>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">
            You are editing this asset
            {lockedAt && (
              <span className="text-green-600/70 dark:text-green-400/70 ml-1">
                (since {formatLockTime(lockedAt)})
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  // Locked by another user
  return (
    <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          This asset is being edited by another user
          {lockedAt && (
            <span className="text-amber-600/70 dark:text-amber-400/70 ml-1">
              (since {formatLockTime(lockedAt)})
            </span>
          )}
        </span>
      </div>
      <span className="text-xs text-amber-600 dark:text-amber-400">
        Read-only mode
      </span>
    </div>
  );
}
