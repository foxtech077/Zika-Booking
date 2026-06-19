"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { useAuthStore } from "@/stores/auth";
import { Spinner } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, token, setSession, clearSession, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Step 1: Wait for hydration (client mount).
  // Redirect ONLY after mounting is confirmed.
  useEffect(() => {
    if (!mounted || !_hasHydrated) return;

    if (!isAuthenticated || !token) {
      router.replace("/login");
      return;
    }

    // Step 2: If authenticated but user profile is missing (old session without role),
    // refetch from /admin/auth/me to populate the store.
    if (!user?.role) {
      api
        .get("/admin/auth/me")
        .then((res) => {
          const profile = res.data?.data?.user ?? res.data?.user;
          if (profile) {
            setSession(token, profile);
          } else {
            clearSession();
            router.replace("/login");
          }
        })
        .catch(() => {
          clearSession();
          router.replace("/login");
        });
    }
  }, [mounted, _hasHydrated, isAuthenticated, token, user?.role, setSession, clearSession, router]);

  // Show spinner until layout has mounted in the browser and store is hydrated
  if (!mounted || !_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <Spinner size="lg" />
      </div>
    );
  }

  // Unauthenticated — redirect is in flight
  if (!isAuthenticated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <Spinner size="lg" />
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}
