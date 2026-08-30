import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Hook to refetch a query or list whenever the screen comes into focus,
 * including during back navigation or tab switches.
 *
 * The callback is read through a ref so the focus effect only ever fires on
 * real focus transitions. Keying the effect on the callback itself made it
 * re-run on every render whenever a caller passed an unstable function
 * (e.g. one that closed over query objects) — each refetch re-rendered the
 * screen, which re-created the callback, which re-fired the effect: an
 * infinite refetch loop with the refresh spinner stuck on.
 */
export function useRefreshOnFocus(refetchFn: () => void | Promise<unknown>, enabled: boolean = true) {
  const isFirstRun = useRef(true);
  const fnRef = useRef(refetchFn);
  fnRef.current = refetchFn;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useFocusEffect(
    useCallback(() => {
      if (!enabledRef.current) return;
      if (isFirstRun.current) {
        isFirstRun.current = false;
        return;
      }
      void fnRef.current();
    }, [])
  );
}
