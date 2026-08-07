import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Hook to refetch a query or list whenever the screen comes into focus,
 * including during back navigation or tab switches.
 */
export function useRefreshOnFocus(refetchFn: () => void | Promise<unknown>, enabled: boolean = true) {
  const isFirstRun = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (isFirstRun.current) {
        isFirstRun.current = false;
        return;
      }
      void refetchFn();
    }, [refetchFn, enabled])
  );
}
