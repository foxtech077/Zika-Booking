"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AlertProvider } from "@/context/AlertProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,       // 30s
            gcTime: 5 * 60_000,      // 5 min
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={qc}>
    <AlertProvider>{children}</AlertProvider>
    </QueryClientProvider>
  );
}
