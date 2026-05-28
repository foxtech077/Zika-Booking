"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { useAuthStore } from "@/stores/auth";
import { Spinner } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";

export default function ProviderDashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, token, setSession, clearSession, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;

    if (!isAuthenticated || !token) {
      router.replace("/auth/login");
      return;
    }

    // If user is missing (e.g. storage cleared), re-fetch from /auth/me
    if (!user?.id) {
      api
        .get("/auth/me")
        .then((res) => {
          const u = res.data?.data?.user ?? res.data?.user;
          if (u && u.userType === "provider") {
            setSession(token, u);
          } else {
            clearSession();
            router.replace("/auth/login");
          }
        })
        .catch(() => {
          clearSession();
          router.replace("/auth/login");
        });
      return;
    }

    // Block travellers from accessing provider routes
    if (user.userType !== "provider") {
      router.replace("/traveller");
    }
  }, [_hasHydrated, isAuthenticated, token, user?.id, user?.userType, setSession, clearSession, router]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user?.id || user.userType !== "provider") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <Spinner size="lg" />
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}
