import { QueryClient } from "@tanstack/react-query";

// Single shared QueryClient instance. Extracted to its own module (rather than
// living inline in app/_layout.tsx) so imperative, non-hook code — e.g. the
// profile-photo expired-URL recovery in hooks/profile.ts — can fetch/invalidate
// queries without needing a React component/hook context.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
