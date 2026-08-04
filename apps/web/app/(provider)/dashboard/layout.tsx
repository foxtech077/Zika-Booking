"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { useAuthStore } from "@/stores/auth";
import { Spinner } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";

// Routes that manage listings/earnings require an approved host profile. The
// host-onboarding page and account-level settings stay reachable by any
// authenticated user.
const HOST_GATED_PREFIXES = [
  "/dashboard/listings",
  "/dashboard/bookings",
  "/dashboard/calendar",
  "/dashboard/channel",
  "/dashboard/messaging",
  "/dashboard/earnings",
  "/dashboard/payments",
  "/dashboard/reviews",
  "/dashboard/notifications",
];

export default function ProviderDashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, token, setSession, clearSession, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const isHostGated = HOST_GATED_PREFIXES.some((p) => pathname?.startsWith(p));

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
          if (u) {
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

    // Host-gated routes require an approved host profile. Redirect to the
    // onboarding flow when the user has not filled it in, is pending, or was
    // rejected. Approved hosts (and users whose JWT predates hostStatus)
    // proceed — the backend enforces hostStatus on listing endpoints anyway.
    if (isHostGated && user.hostStatus !== "approved") {
      router.replace("/dashboard/host");
      return;
    }
  }, [_hasHydrated, isAuthenticated, token, user?.id, user?.hostStatus, isHostGated, setSession, clearSession, router]);

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

  if (!user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <Spinner size="lg" />
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}
