"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { useAuthStore } from "@/stores/auth";
import { Spinner } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { refreshAccessToken } from "@/lib/token-refresh";

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

  // Host-gated routes require an approved host profile. Before bouncing a
  // non-approved user to onboarding, silently refresh the token once —
  // /auth/refresh returns the fresh user (hostStatus included) and re-mints
  // the JWT. A user approved since their last refresh is then let through
  // instead of being misrouted, without any extra network call for approved
  // users.
  const hostGateRefreshedRef = useRef(false);

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

    // Redirect to onboarding when the host profile has not been filled in, is
    // pending, or was rejected. Approved hosts proceed — the backend enforces
    // hostStatus on listing endpoints anyway.
    if (isHostGated && user.hostStatus !== "approved") {
      if (!hostGateRefreshedRef.current) {
        hostGateRefreshedRef.current = true;
        refreshAccessToken().then(() => {
          // Re-evaluate against the (possibly updated) store user. The refresh
          // helper updates the store synchronously with the fresh user, so this
          // runs after user.hostStatus is already refreshed.
          const current = useAuthStore.getState().user;
          if (current?.hostStatus !== "approved") {
            router.replace("/dashboard/host");
          }
        });
      } else {
        router.replace("/dashboard/host");
      }
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

  // Never mount host-gated children until the user is confirmed approved. The
  // gate effect refreshes the token once (re-minting hostStatus) before
  // bouncing to onboarding, so a just-approved host is let through — and no
  // gated request is ever fired with a stale JWT.
  if (isHostGated && user.hostStatus !== "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
        <Spinner size="lg" />
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}
