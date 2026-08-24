"use client";
import "@/lib/fontScale";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WebFcmSetup } from "@/components/notifications/WebFcmSetup";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <WebFcmSetup />
      {children}
    </QueryClientProvider>
  );
}
