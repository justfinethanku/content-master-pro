import { useMemo, useSyncExternalStore } from "react";

/**
 * Reactive hook that tracks a CSS media query.
 * Uses useSyncExternalStore for tear-free reads (no layout flash).
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 639px)");
 * const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(
    () => (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query]
  );

  const getSnapshot = () => window.matchMedia(query).matches;
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
