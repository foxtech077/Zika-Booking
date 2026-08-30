"use client";

import { Bell, CheckCheck, Inbox } from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "@/hooks/useNotifications";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

// This page previously held a "prepare notification" composer whose only effect
// was a local success banner — no send path existed. The provider bell in the
// TopBar links here and shows a real unread count, so it now renders the real
// notification feed from GET /notifications, the same source the traveller and
// mobile clients use.

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const unread = !notification.isRead;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 transition",
        unread ? "border-primary-100 bg-primary-50/50" : "border-border bg-white"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          unread ? "bg-primary-100 text-primary" : "bg-slate-100 text-slate-400"
        )}
      >
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className={cn("text-sm", unread ? "font-semibold text-slate-950" : "font-medium text-slate-700")}>
            {notification.title}
          </p>
          <span className="shrink-0 text-xs text-slate-400">{relativeTime(notification.createdAt)}</span>
        </div>
        {notification.body && <p className="mt-1 text-sm leading-5 text-slate-600">{notification.body}</p>}
      </div>
      {unread && (
        <button
          type="button"
          onClick={() => onRead(notification.id)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-white"
        >
          Mark read
        </button>
      )}
    </div>
  );
}

export default function ProviderNotificationsPage() {
  const { data: notifications = [], isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}`
            : "Booking, payout, and review activity for your listings."
        }
        action={
          unreadCount > 0 ? (
            <Button
              size="sm"
              variant="outline"
              icon={<CheckCheck />}
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <p className="font-semibold text-slate-900">Could not load notifications</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <Inbox className="h-10 w-10 text-slate-300" />
            <p className="font-semibold text-slate-900">You&apos;re all caught up</p>
            <p className="text-sm text-slate-500">New bookings, payouts, and reviews will show up here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onRead={(id) => markRead.mutate(id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
