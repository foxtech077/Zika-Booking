"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Calendar,
  MessageSquare,
  Flame,
  CreditCard,
  Clock,
  Trophy,
  Info,
  CheckCheck,
  ChevronRight,
  Inbox,
  AlertTriangle
} from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification
} from "@/hooks/useNotifications";
import { useAuthStore } from "@/stores/auth";
import { formatRelativeTime } from "@/lib/utils";

// ── Category helpers ──────────────────────────────────────────────────────────

type Category = "booking" | "message" | "promotion" | "payment" | "reminder" | "loyalty" | "system";

function getCategory(type: string): Category {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("booking") || t === "new_booking" || t.includes("checkin") || t.includes("checkout") || t === "review_received" || t === "listing_approved") return "booking";
  if (t.includes("message") || t.includes("chat") || t.includes("conversation")) return "message";
  if (t.includes("promotion") || t.includes("promo") || t.includes("sale") || t.includes("offer") || t.includes("deal")) return "promotion";
  if (t.includes("payment") || t.includes("refund") || t === "payment_received") return "payment";
  if (t.includes("reminder") || t.includes("upcoming")) return "reminder";
  if (t.includes("loyalty") || t.includes("reward") || t.includes("point") || t.includes("tier")) return "loyalty";
  return "system";
}

const CATEGORY_CFG: Record<Category, { icon: React.ComponentType<any>; color: string; bg: string; border: string }> = {
  booking:   { icon: Calendar,      color: "text-emerald-600",   bg: "bg-emerald-50",   border: "border-emerald-100" },
  message:   { icon: MessageSquare, color: "text-blue-600",      bg: "bg-blue-50",      border: "border-blue-100" },
  promotion: { icon: Flame,         color: "text-orange-600",    bg: "bg-orange-50",    border: "border-orange-100" },
  payment:   { icon: CreditCard,    color: "text-violet-600",    bg: "bg-violet-50",    border: "border-violet-100" },
  reminder:  { icon: Clock,         color: "text-cyan-600",      bg: "bg-cyan-50",      border: "border-cyan-100" },
  loyalty:   { icon: Trophy,        color: "text-amber-600",     bg: "bg-amber-50",     border: "border-amber-100" },
  system:    { icon: Info,          color: "text-slate-600",     bg: "bg-slate-50",     border: "border-slate-100" },
};

function NotificationSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-5 rounded-2xl bg-white border border-slate-150 animate-pulse shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-100 rounded w-1/3" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TravellerNotificationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Filter & process notifications list
  const notifications = useMemo(() => {
    const raw = Array.isArray(data) ? data : [];
    const sorted = [...raw].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filter === "unread") {
      return sorted.filter((n) => !n.isRead);
    }
    return sorted;
  }, [data, filter]);

  const unreadCount = useMemo(() => {
    const raw = Array.isArray(data) ? data : [];
    return raw.filter((n) => !n.isRead).length;
  }, [data]);

  const handleNotificationClick = (item: AppNotification) => {
    if (!item.isRead) {
      markRead.mutate(item.id);
    }

    const { bookingId, conversationId, listingId } = item.data ?? {};
    if (bookingId) {
      router.push(`/?tab=bookings&bookingId=${bookingId}`);
    } else if (conversationId) {
      router.push(`/traveller/messages`);
    } else if (listingId) {
      // Open the listing the notification is about. This previously navigated
      // to the bare home page, discarding the id the notification carried.
      router.push(`/?listing=${listingId}`);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
        <p className="text-slate-500 mt-2">Please sign in to view your notifications.</p>
        <button
          onClick={() => router.push("/auth/login")}
          className="mt-6 rounded-full bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#081b0d] transition"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-900 flex items-center gap-3">
              Notifications
              {unreadCount > 0 && (
                <span className="inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white leading-none">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Stay updated with your latest reservations, messages, and offers
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 transition shadow-sm hover:bg-emerald-50 disabled:opacity-50 uppercase tracking-wide cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter & Actions Bar */}
        <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                filter === "all"
                  ? "bg-[#0c2614] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-350"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition flex items-center gap-2 ${
                filter === "unread"
                  ? "bg-[#0c2614] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-350"
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className={`inline-block w-2 h-2 rounded-full ${filter === "unread" ? "bg-white" : "bg-rose-500"}`} />
              )}
            </button>
          </div>
        </div>

        {/* Content body */}
        {isLoading ? (
          <NotificationSkeleton />
        ) : isError ? (
          <div className="text-center py-16 rounded-2xl bg-white border border-slate-150 shadow-sm">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-100">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-850">Failed to load notifications</h3>
            <p className="text-sm text-slate-500 mt-1">There was a problem loading your notifications list.</p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Try Again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 rounded-3xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="w-16 h-16 bg-[#f0fdf4] text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-[#e2fbe9]">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-serif font-bold text-slate-850">You're all caught up!</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
              {filter === "unread"
                ? "No unread notifications right now."
                : "No notifications available. We'll alert you about bookings, messages, and account events."}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {notifications.map((item) => {
              const cat = getCategory(item.type);
              const cfg = CATEGORY_CFG[cat] || CATEGORY_CFG.system;
              const IconComp = cfg.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`group relative flex gap-4 p-5 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                    item.isRead
                      ? "bg-white border-slate-100"
                      : "bg-white border-emerald-200 ring-1 ring-emerald-50 hover:border-emerald-300"
                  }`}
                >
                  {/* Left accent bar for unread notifications */}
                  {!item.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl bg-emerald-600" />
                  )}

                  {/* Icon wrap */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bg} ${cfg.color} ${cfg.border} transition-transform group-hover:scale-105`}>
                    <IconComp className="h-5.5 w-5.5" />
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className={`text-sm font-semibold truncate ${item.isRead ? "text-slate-800" : "text-slate-900 font-bold"}`}>
                        {item.title}
                      </h4>
                      <span className="text-xs text-slate-400 whitespace-nowrap pt-0.5">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                  </div>

                  {/* Action/Chevron Indicator */}
                  <div className="flex items-center self-center text-slate-300 group-hover:text-emerald-700 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
