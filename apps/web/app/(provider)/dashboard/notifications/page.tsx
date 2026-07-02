"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { listingApi } from "@/lib/listing-api";
import { cn } from "@/lib/utils";

type NotificationType =
  | "booking_confirmed"
  | "reservation_timer"
  | "new_message"
  | "voucher_assigned"
  | "voucher_expiry"
  | "tier_upgrade"
  | "payout_sent"
  | "listing_approved"
  | "listing_rejected"
  | "listing_auto_suspended"
  | "commission_update"
  | "sales_escalation"
  | "messaging_suspended"
  | string;

type ProviderNotification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

type NotificationsResponse = {
  notifications: ProviderNotification[];
  total: number;
};

const PAGE_SIZE = 10;

const TYPE_META: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "default"; icon: ReactNode }> = {
  booking_confirmed: { label: "Booking", tone: "success", icon: <CheckCircle2 /> },
  reservation_timer: { label: "Reservation", tone: "warning", icon: <Clock3 /> },
  new_message: { label: "Message", tone: "info", icon: <Mail /> },
  voucher_assigned: { label: "Voucher", tone: "success", icon: <BellRing /> },
  voucher_expiry: { label: "Voucher", tone: "warning", icon: <Clock3 /> },
  tier_upgrade: { label: "Tier", tone: "success", icon: <CheckCircle2 /> },
  payout_sent: { label: "Payout", tone: "success", icon: <CheckCircle2 /> },
  listing_approved: { label: "Listing", tone: "success", icon: <CheckCircle2 /> },
  listing_rejected: { label: "Listing", tone: "danger", icon: <BellRing /> },
  listing_auto_suspended: { label: "Listing", tone: "danger", icon: <BellRing /> },
  commission_update: { label: "Commission", tone: "warning", icon: <Bell /> },
  sales_escalation: { label: "Sales", tone: "warning", icon: <BellRing /> },
  messaging_suspended: { label: "Messaging", tone: "danger", icon: <BellRing /> },
};

function unwrapApiData(data: any) {
  return data?.data ?? data ?? {};
}

function normalizeNotification(item: any): ProviderNotification {
  return {
    id: String(item.id),
    title: String(item.title ?? "Notification"),
    message: String(item.message ?? item.body ?? ""),
    type: String(item.type ?? "notification"),
    isRead: Boolean(item.isRead ?? item.is_read ?? item.read),
    createdAt: String(item.createdAt ?? item.created_at ?? new Date().toISOString()),
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : null,
  };
}

async function fetchNotifications(offset: number): Promise<NotificationsResponse> {
  const response = await listingApi.get("/notifications", {
    params: { limit: PAGE_SIZE, offset },
  });
  const data = unwrapApiData(response.data);
  const raw = Array.isArray(data)
    ? data
    : data.notifications ?? data.items ?? data.results ?? [];
  const notifications = raw.map(normalizeNotification);

  return {
    notifications,
    total: Number(data.total ?? data.count ?? notifications.length),
  };
}

async function fetchUnreadCount() {
  const response = await listingApi.get("/notifications/unread-count");
  const data = unwrapApiData(response.data);
  return Number(data.count ?? data.unreadCount ?? 0);
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(err: any, fallback: string) {
  return err.response?.data?.message
    || err.response?.data?.error?.message
    || err.message
    || fallback;
}

function getNotificationLink(metadata?: Record<string, unknown> | null) {
  if (!metadata) return null;
  const candidate = metadata.href ?? metadata.url ?? metadata.link ?? metadata.deepLink ?? metadata.path;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function getMetadataRows(metadata?: Record<string, unknown> | null) {
  if (!metadata) return [];
  return Object.entries(metadata)
    .filter(([key, value]) => !["href", "url", "link", "deepLink", "path"].includes(key) && value != null)
    .slice(0, 4)
    .map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : String(value)] as const);
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<ProviderNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadOnPage = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  const loadNotifications = useCallback(async (nextOffset = offset, mode: "load" | "refresh" = "load") => {
    if (mode === "load") setIsLoading(true);
    if (mode === "refresh") setIsRefreshing(true);
    setError(null);

    try {
      const [notificationResult, unread] = await Promise.all([
        fetchNotifications(nextOffset),
        fetchUnreadCount(),
      ]);
      setNotifications(notificationResult.notifications);
      setTotal(notificationResult.total);
      setUnreadCount(unread);
    } catch (err: any) {
      setError(getErrorMessage(err, "Unable to load notifications."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [offset]);

  useEffect(() => {
    loadNotifications(offset);
  }, [loadNotifications, offset]);

  const markAsRead = async (notification: ProviderNotification) => {
    if (notification.isRead || markingId) return;
    setMarkingId(notification.id);
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await listingApi.patch(`/notifications/${notification.id}/read`, {});
    } catch (err: any) {
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, isRead: false } : item));
      setUnreadCount((count) => count + 1);
      setError(getErrorMessage(err, "Unable to mark notification as read."));
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    const previousNotifications = notifications;
    const previousUnread = unreadCount;
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await listingApi.patch("/notifications/read-all", {});
    } catch (err: any) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
      setError(getErrorMessage(err, "Unable to mark notifications as read."));
    } finally {
      setIsMarkingAll(false);
    }
  };

  const goToPage = (pageOffset: number) => {
    setOffset(Math.max(0, pageOffset));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Provider Notifications"
        subtitle="In-app notification history for bookings, payouts, listings, messages, vouchers, and policy updates."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              icon={<RefreshCw />}
              loading={isRefreshing}
              onClick={() => loadNotifications(offset, "refresh")}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={<CheckCheck />}
              loading={isMarkingAll}
              disabled={unreadCount === 0}
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Unread" value={String(unreadCount)} icon={<BellRing />} tone={unreadCount > 0 ? "warning" : "success"} />
        <StatusCard label="This page" value={`${notifications.length} shown`} icon={<Inbox />} tone="neutral" />
        <StatusCard label="Page unread" value={String(unreadOnPage)} icon={<Mail />} tone={unreadOnPage > 0 ? "warning" : "muted"} />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inbox</h3>
              <p className="mt-0.5 text-xs text-slate-400">{total} notification{total === 1 ? "" : "s"} total</p>
            </div>
            <Badge label={unreadCount > 0 ? `${unreadCount} unread` : "All read"} variant={unreadCount > 0 ? "warning" : "success"} dot />
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-green-700" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-900">No notifications</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">Provider notifications will appear here when backend events are created.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                marking={markingId === notification.id}
                onMarkRead={markAsRead}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-slate-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronLeft />}
              disabled={offset === 0 || isLoading}
              onClick={() => goToPage(offset - PAGE_SIZE)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronRight />}
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => goToPage(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function NotificationRow({
  notification,
  marking,
  onMarkRead,
}: {
  notification: ProviderNotification;
  marking: boolean;
  onMarkRead: (notification: ProviderNotification) => void;
}) {
  const meta = TYPE_META[notification.type] ?? { label: notification.type, tone: "default" as const, icon: <Bell /> };
  const link = getNotificationLink(notification.metadata);
  const rows = getMetadataRows(notification.metadata);

  return (
    <article
      className={cn(
        "grid gap-4 px-5 py-4 transition-colors md:grid-cols-[44px_minmax(0,1fr)_auto]",
        notification.isRead ? "bg-white" : "bg-green-50/50"
      )}
    >
      <div className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5",
        notification.isRead ? "bg-slate-100 text-slate-500" : "bg-green-700 text-white"
      )}>
        {meta.icon}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate text-sm font-bold text-slate-950">{notification.title}</h4>
          <Badge label={meta.label} variant={meta.tone} />
          {!notification.isRead && <span className="h-2 w-2 rounded-full bg-green-600" />}
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>{formatNotificationDate(notification.createdAt)}</span>
          <span>{notification.type}</span>
        </div>
        {rows.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {rows.map(([key, value]) => (
              <div key={key} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{key}</p>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-700">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:justify-end">
        {link && <NotificationLink href={link} onClick={() => onMarkRead(notification)} />}
        <Button
          variant={notification.isRead ? "secondary" : "outline"}
          size="sm"
          loading={marking}
          disabled={notification.isRead}
          icon={<CheckCircle2 />}
          onClick={() => onMarkRead(notification)}
        >
          {notification.isRead ? "Read" : "Mark read"}
        </Button>
      </div>
    </article>
  );
}

function NotificationLink({ href, onClick }: { href: string; onClick: () => void }) {
  const className = "inline-flex h-8 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50";
  const content = (
    <>
      <ExternalLink className="h-3.5 w-3.5" />
      Open
    </>
  );

  if (href.startsWith("/")) {
    return (
      <Link href={href} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} onClick={onClick} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  );
}

function StatusCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "success" | "warning" | "neutral" | "muted";
}) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    neutral: "bg-green-50 text-green-700",
    muted: "bg-slate-100 text-slate-500",
  };

  return (
    <Card className="min-h-[112px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5", styles[tone])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
