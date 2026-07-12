import { QueryClient } from "@tanstack/react-query";

// Single shared QueryClient instance. Extracted to its own module (rather than
// living inline in app/_layout.tsx) so imperative, non-hook code — e.g. the
// profile-photo expired-URL recovery in hooks/profile.ts — can fetch/invalidate
// queries without needing a React component/hook context.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Keep unused cache entries alive for 10 min (RQ default is 5 min).
      // This lets paginated list data survive typical tab-switch / back-navigation
      // round-trips without triggering a fresh network request.
      gcTime: 10 * 60_000,
      // Do not automatically refetch when the app comes back to the foreground.
      // Lists are already kept fresh through staleTime-driven background refetches
      // initiated when the component re-subscribes.
      refetchOnWindowFocus: false,
    },
  },
});
