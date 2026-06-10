"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Star,
} from "lucide-react";
import { listingsService } from "@/services/listings";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";

type NotificationFilter = "all" | "unread" | "read";
type NotificationType =
  | "new_booking"
  | "booking_confirmed"
  | "review_received"
  | "new_message"
  | "system_alert";

interface ProviderNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  relatedLabel?: string;
  relatedHref?: string;
}

function typeLabel(type: NotificationType) {
  return type
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

async function fetchNotifications() {
  try {
    const dashboard = await listingsService.getDashboard();
    const now = new Date().toISOString();
    const notifications: ProviderNotification[] = [];

    if (dashboard.unreadMessages > 0) {
      notifications.push({
        id: "unread-messages",
        title: `${dashboard.unreadMessages} unread message${dashboard.unreadMessages === 1 ? "" : "s"}`,
        message: "Open your inbox to review guest conversations that need attention.",
        type: "new_message",
        read: false,
        createdAt: now,
        relatedHref: "/dashboard/messaging",
      });
    }

    if (dashboard.pendingReviews > 0) {
      notifications.push({
        id: "pending-reviews",
        title: `${dashboard.pendingReviews} review${dashboard.pendingReviews === 1 ? "" : "s"} awaiting reply`,
        message: "Respond to recent guest feedback from the reviews dashboard.",
        type: "review_received",
        read: false,
        createdAt: now,
        relatedHref: "/dashboard/reviews",
      });
    }

    for (const booking of dashboard.recentBookings ?? []) {
      notifications.push({
        id: `booking-${booking.id}`,
        title: `Booking ${booking.reference}`,
        message: `${booking.guestName} booked ${booking.listingTitle ?? "a listing"}.`,
        type: booking.status === "confirmed" ? "booking_confirmed" : "new_booking",
        read: true,
        createdAt: booking.createdAt,
        relatedLabel: booking.listingTitle ?? booking.listingCategory,
        relatedHref: `/dashboard/bookings?id=${booking.id}`,
      });
    }

    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

function notificationIcon(type: NotificationType) {
  const className = "h-5 w-5";
  const icons: Record<NotificationType, ReactNode> = {
    new_booking: <BookOpen className={className} />,
    booking_confirmed: <CheckCircle2 className={className} />,
    review_received: <Star className={className} />,
    new_message: <MessageSquare className={className} />,
    system_alert: <AlertCircle className={className} />,
  };
  return icons[type];
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [localRead, setLocalRead] = useState<Record<string, boolean>>({});

  const { data: notifications = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["provider-notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const mergedNotifications = useMemo(
    () => notifications.map((item) => ({ ...item, read: localRead[item.id] ?? item.read })),
    [localRead, notifications]
  );

  const unreadCount = mergedNotifications.filter((item) => !item.read).length;
  const filteredNotifications = mergedNotifications.filter((item) => {
    if (filter === "unread") return !item.read;
    if (filter === "read") return item.read;
    return true;
  });

  const markRead = (id: string) => {
    setLocalRead((current) => ({ ...current, [id]: true }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Notifications"
        subtitle="Review provider alerts, booking updates, messages, payouts, and system notices."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !isLoading} onClick={() => refetch()}>
              Refresh
            </Button>
            <Button icon={<CheckCircle2 />} disabled={unreadCount === 0} onClick={() => setLocalRead(Object.fromEntries(mergedNotifications.map((item) => [item.id, true])))}>
              Mark all as read
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="All Notifications" value={mergedNotifications.length} icon={<Bell />} active={filter === "all"} onClick={() => setFilter("all")} />
        <SummaryCard label="Unread" value={unreadCount} icon={<AlertCircle />} active={filter === "unread"} onClick={() => setFilter("unread")} />
        <SummaryCard label="Read" value={mergedNotifications.length - unreadCount} icon={<CheckCircle2 />} active={filter === "read"} onClick={() => setFilter("read")} />
      </div>

      <Card>
        {isLoading ? (
          <NotificationSkeleton />
        ) : filteredNotifications.length === 0 ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Bell className="h-7 w-7" />
            </div>
            <p className="mt-4 font-semibold text-slate-900">
              {filter === "unread" ? "No unread notifications" : "No notifications available"}
            </p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {filter === "unread"
                ? "You are all caught up. New unread alerts will appear here."
                : "Booking, listing, payout, message, and system alerts will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "group rounded-xl border p-4 transition-all hover:border-primary/40 hover:shadow-sm",
                  notification.read ? "border-border bg-white" : "border-primary-100 bg-primary-50/70"
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <Link
                    href={notification.relatedHref ?? "/dashboard/notifications"}
                    onClick={() => markRead(notification.id)}
                    className="flex min-w-0 flex-1 gap-3"
                  >
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        notification.read ? "bg-slate-100 text-slate-500" : "bg-primary text-white"
                      )}
                    >
                      {notificationIcon(notification.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                        <p className={cn("text-sm text-slate-950", notification.read ? "font-semibold" : "font-bold")}>
                          {notification.title}
                        </p>
                        <Badge label={typeLabel(notification.type)} status={notification.read ? "pending" : "confirmed"} />
                      </div>
                      <p className={cn("mt-1 text-sm leading-6", notification.read ? "text-slate-500" : "text-slate-700")}>
                        {notification.message}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{formatRelativeTime(notification.createdAt)}</span>
                        <span>{formatDate(notification.createdAt)}</span>
                        {notification.relatedLabel && <span>{notification.relatedLabel}</span>}
                      </div>
                    </div>
                  </Link>

                  <div className="flex shrink-0 gap-2 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    {!notification.read && (
                      <Button size="xs" variant="outline" onClick={() => markRead(notification.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-5 text-left shadow-card transition-all",
        active ? "border-primary bg-primary-50" : "border-border bg-white hover:border-primary/40"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5", active ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
          {icon}
        </div>
      </div>
    </button>
  );
}
