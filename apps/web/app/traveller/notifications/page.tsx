"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  Clock,
  MessageSquare,
  Ticket,
  Award,
  Wallet,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/services/traveller";
import { useNotificationBadge } from "@/hooks/useNotifications";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  booking_confirmed: CheckCircle2,
  reservation_timer: Clock,
  new_message: MessageSquare,
  voucher_assigned: Ticket,
  voucher_expiry: AlertTriangle,
  tier_upgrade: Award,
  payout_sent: Wallet,
  listing_approved: CheckCircle2,
  listing_rejected: XCircle,
  listing_auto_suspended: AlertTriangle,
  commission_update: Wallet,
  sales_escalation: AlertTriangle,
  messaging_suspended: MessageSquare,
};

const TYPE_TONE: Record<string, string> = {
  booking_confirmed: "bg-emerald-50 text-emerald-600",
  reservation_timer: "bg-amber-50 text-amber-600",
  new_message: "bg-blue-50 text-blue-600",
  voucher_assigned: "bg-purple-50 text-purple-600",
  voucher_expiry: "bg-amber-50 text-amber-600",
  tier_upgrade: "bg-[#1D8D2B]/10 text-[#1D8D2B]",
  payout_sent: "bg-emerald-50 text-emerald-600",
  listing_rejected: "bg-red-50 text-red-500",
  listing_auto_suspended: "bg-red-50 text-red-500",
  sales_escalation: "bg-red-50 text-red-500",
};

function formatType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 animate-pulse">
      <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded bg-slate-200" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const { refetch: refetchBadge } = useNotificationBadge();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }
    loadNotifications(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isAuthenticated]);

  async function loadNotifications(cursor: string | undefined, reset: boolean) {
    if (reset) { setLoading(true); setError(null); } else { setLoadingMore(true); }
    try {
      const res = await fetchNotifications(cursor);
      setNotifications((prev) => (reset ? res.notifications : [...prev, ...res.notifications]));
      setNextCursor(res.nextCursor);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? "Failed to load notifications.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleOpenNotification(notification: AppNotification) {
    if (notification.isRead) return;
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
    );
    try {
      await markNotificationRead(notification.id);
      refetchBadge();
    } catch {
      // Revert on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: false } : n)),
      );
    }
  }

  async function handleMarkAllRead() {
    if (marking || notifications.every((n) => n.isRead)) return;
    setMarking(true);
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead();
      refetchBadge();
    } catch {
      setNotifications(previous);
    } finally {
      setMarking(false);
    }
  }

  const hasUnread = notifications.some((n) => !n.isRead);

  if (!_hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-4 w-14 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/traveller"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1D8D2B] transition uppercase tracking-wide"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>
            <div>
              <h1 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#1D8D2B]" />
                Notifications
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {hasUnread && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={marking}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1D8D2B] px-4 py-2 text-xs font-bold text-[#1D8D2B] transition hover:bg-[#0c2614] hover:text-white hover:border-[#0c2614] disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {marking ? "Marking…" : "Mark All as Read"}
            </button>
          )}
        </div>

        {/* Error */}
        {error && !loading && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-red-700 text-sm font-medium">
            <span>{error}</span>
            <button type="button" onClick={() => loadNotifications(undefined, true)} className="ml-4 underline hover:no-underline shrink-0">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && notifications.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Bell className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-lg">No notifications yet</p>
              <p className="text-slate-400 text-sm mt-1">Booking updates and messages will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              const tone = TYPE_TONE[n.type] ?? "bg-slate-100 text-slate-500";
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpenNotification(n)}
                  className={`w-full flex items-start gap-3 rounded-2xl border p-4 text-left transition hover:shadow-md ${
                    n.isRead ? "bg-white border-slate-100" : "bg-[#1D8D2B]/[0.04] border-[#1D8D2B]/20"
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${n.isRead ? "font-semibold text-slate-700" : "font-bold text-slate-900"}`}>
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <span className="inline-block mt-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 rounded-full px-2 py-0.5">
                      {formatType(n.type)}
                    </span>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1D8D2B]" aria-label="Unread" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {nextCursor && (
          <div className="mt-8 text-center">
            <button
              onClick={() => loadNotifications(nextCursor, false)}
              disabled={loadingMore}
              className="px-6 py-2.5 border-2 border-[#1D8D2B] text-[#1D8D2B] text-sm font-bold rounded-full hover:bg-[#0c2614] hover:text-white transition disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load More"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
