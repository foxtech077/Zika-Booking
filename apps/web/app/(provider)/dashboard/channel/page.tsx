"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import type { Listing } from "@/types/provider";

type SyncStatus = "connected" | "syncing" | "failed" | "disconnected" | "warning";

interface IcalFeed {
  id: string;
  listingId: string;
  listingName: string;
  name: string;
  platform: string;
  feedUrl: string;
  status: SyncStatus;
  isActive: boolean;
  lastSyncedAt?: string;
  lastSuccessfulSync?: string;
  lastError?: string;
}

interface BlockedDate {
  id: string;
  listingId: string;
  start: string;
  end: string;
  reason: string;
  source: string;
  type: "blocked" | "reservation" | "maintenance" | "conflict";
}

interface ChannelStatus {
  listingId: string;
  health: SyncStatus;
  activeFeeds: number;
  failedFeeds: number;
  pendingSyncs: number;
  lastSuccessfulSync?: string;
}

interface Notice {
  type: "success" | "error";
  text: string;
}

const platforms = [
  { value: "all", label: "All platforms" },
  { value: "airbnb", label: "Airbnb" },
  { value: "booking.com", label: "Booking.com" },
  { value: "google", label: "Google Calendar" },
  { value: "custom", label: "Custom iCal Feed" },
];

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "connected", label: "Connected" },
  { value: "syncing", label: "Syncing" },
  { value: "failed", label: "Failed" },
  { value: "disconnected", label: "Disconnected" },
  { value: "warning", label: "Warning" },
];

const feedPlatforms = platforms.filter((item) => item.value !== "all");
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function unwrapList<T>(payload: unknown, keys: string[]): T[] {
  const root = payload as Record<string, unknown>;
  const data = root?.data as Record<string, unknown> | undefined;
  for (const source of [data, root]) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return Array.isArray(payload) ? payload as T[] : [];
}

function normalizeStatus(value: unknown): SyncStatus {
  const status = readString(value, "connected").toLowerCase();
  if (["syncing", "failed", "disconnected", "warning"].includes(status)) return status as SyncStatus;
  return "connected";
}

function normalizeFeed(raw: unknown, listing: Listing): IcalFeed {
  const item = raw as Record<string, unknown>;
  const id = readString(item.id ?? item._id ?? item.feedId, crypto.randomUUID());
  const isActive = item.isActive !== false && item.active !== false;
  const status = normalizeStatus(item.status ?? item.syncStatus ?? (isActive ? "connected" : "disconnected"));

  return {
    id,
    listingId: listing.id,
    listingName: listing.name ?? listing.id,
    name: readString(item.name ?? item.feedName ?? item.title, "External Calendar"),
    platform: readString(item.platform ?? item.source, "custom").toLowerCase(),
    feedUrl: readString(item.feedUrl ?? item.url ?? item.icalUrl),
    status,
    isActive,
    lastSyncedAt: readString(item.lastSyncedAt ?? item.lastSyncAt ?? item.lastSyncTime),
    lastSuccessfulSync: readString(item.lastSuccessfulSync ?? item.lastSuccessfulSyncAt ?? item.lastSyncedAt),
    lastError: readString(item.lastError ?? item.error),
  };
}

function normalizeBlockedDate(raw: unknown, listingId: string): BlockedDate {
  const item = raw as Record<string, unknown>;
  return {
    id: readString(item.id ?? item._id, crypto.randomUUID()),
    listingId,
    start: readString(item.start ?? item.startDate ?? item.from, new Date().toISOString()),
    end: readString(item.end ?? item.endDate ?? item.to ?? item.start, new Date().toISOString()),
    reason: readString(item.reason ?? item.summary ?? item.title, "Unavailable"),
    source: readString(item.source ?? item.platform, "iCal"),
    type: readString(item.type ?? item.status, "blocked").toLowerCase() as BlockedDate["type"],
  };
}

function normalizeChannelStatus(raw: unknown, listingId: string): ChannelStatus {
  const data = ((raw as Record<string, unknown>)?.data ?? raw) as Record<string, unknown>;
  return {
    listingId,
    health: normalizeStatus(data.health ?? data.status),
    activeFeeds: readNumber(data.activeFeeds),
    failedFeeds: readNumber(data.failedFeeds),
    pendingSyncs: readNumber(data.pendingSyncs),
    lastSuccessfulSync: readString(data.lastSuccessfulSync ?? data.lastSuccessfulSyncAt),
  };
}

async function fetchListings() {
  try {
    const response = await listingApi.get("/listings", { params: { status: "active", limit: 50 } });
    return unwrapList<Listing>(response.data, ["listings", "items", "results"]);
  } catch {
    return [];
  }
}

async function fetchFeedsForListing(listing: Listing) {
  try {
    const response = await listingApi.get(`/listings/${listing.id}/ical-feeds`);
    return unwrapList<unknown>(response.data, ["feeds", "icalFeeds", "items", "results"]).map((item) => normalizeFeed(item, listing));
  } catch {
    return [];
  }
}

async function fetchAllFeeds(listings: Listing[]) {
  const result = await Promise.all(listings.map(fetchFeedsForListing));
  return result.flat();
}

async function fetchBlockedDates(listingId: string) {
  if (!listingId) return [];
  try {
    const response = await listingApi.get(`/listings/${listingId}/blocked-dates`);
    return unwrapList<unknown>(response.data, ["blockedDates", "dates", "items", "results"]).map((item) => normalizeBlockedDate(item, listingId));
  } catch {
    return [];
  }
}

async function fetchChannelStatus(listingId: string) {
  if (!listingId) return null;
  try {
    const response = await listingApi.get(`/listings/${listingId}/channel-status`);
    return normalizeChannelStatus(response.data, listingId);
  } catch {
    return null;
  }
}

function toISODate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function visibleMonthDays(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = addDays(start, -start.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function dateInRange(day: string, start: string, end: string) {
  return day >= toISODate(start) && day <= toISODate(end);
}

function maskUrl(url: string) {
  if (!url) return "No URL provided";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}/.../${url.slice(-10)}`;
  } catch {
    return url.length > 34 ? `${url.slice(0, 18)}...${url.slice(-10)}` : url;
  }
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "webcal:";
  } catch {
    return false;
  }
}

function statusTone(status: SyncStatus) {
  if (status === "connected") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "syncing") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatCard({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5", tone)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />
        </Card>
      ))}
    </div>
  );
}

export default function ChannelPage() {
  const queryClient = useQueryClient();
  const [selectedListing, setSelectedListing] = useState("all");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [addModal, setAddModal] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ listingId: "", name: "", platform: "airbnb", feedUrl: "" });

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["channel-listings"],
    queryFn: fetchListings,
  });

  const listingOptions = useMemo(
    () => [{ value: "all", label: "All listings" }, ...listings.map((listing) => ({ value: listing.id, label: listing.name ?? listing.id }))],
    [listings]
  );

  const activeListingId = selectedListing === "all" ? listings[0]?.id ?? "" : selectedListing;

  const { data: feeds = [], isLoading: feedsLoading, isFetching: feedsFetching } = useQuery({
    queryKey: ["channel-feeds", listings.map((item) => item.id).join("|")],
    queryFn: () => fetchAllFeeds(listings),
    enabled: listings.length > 0,
  });

  const { data: blockedDates = [], isLoading: blockedLoading } = useQuery({
    queryKey: ["channel-blocked-dates", activeListingId],
    queryFn: () => fetchBlockedDates(activeListingId),
    enabled: !!activeListingId,
  });

  const { data: channelStatus } = useQuery({
    queryKey: ["channel-status", activeListingId],
    queryFn: () => fetchChannelStatus(activeListingId),
    enabled: !!activeListingId,
  });

  const addFeedMutation = useMutation({
    mutationFn: () =>
      listingApi.post(`/listings/${form.listingId}/ical-feeds`, {
        name: form.name,
        feedName: form.name,
        platform: form.platform,
        source: form.platform,
        feedUrl: form.feedUrl,
        url: form.feedUrl,
      }),
    onSuccess: () => {
      setNotice({ type: "success", text: "iCal feed connected successfully." });
      setAddModal(false);
      setFormError("");
      setForm({ listingId: "", name: "", platform: "airbnb", feedUrl: "" });
      queryClient.invalidateQueries({ queryKey: ["channel-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["channel-status"] });
    },
    onError: () => setFormError("Failed to add feed. Please verify the URL and try again."),
  });

  const deleteFeedMutation = useMutation({
    mutationFn: (feed: IcalFeed) => listingApi.delete(`/listings/${feed.listingId}/ical-feeds/${feed.id}`),
    onSuccess: () => {
      setNotice({ type: "success", text: "Connected feed removed." });
      queryClient.invalidateQueries({ queryKey: ["channel-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["channel-blocked-dates"] });
      queryClient.invalidateQueries({ queryKey: ["channel-status"] });
    },
    onError: () => setNotice({ type: "error", text: "Could not remove feed. Please try again." }),
  });

  const syncFeedMutation = useMutation({
    mutationFn: (feed: IcalFeed) => listingApi.post(`/listings/${feed.listingId}/ical-feeds/${feed.id}/sync`),
    onSuccess: () => {
      setNotice({ type: "success", text: "Manual sync started." });
      queryClient.invalidateQueries({ queryKey: ["channel-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["channel-blocked-dates"] });
      queryClient.invalidateQueries({ queryKey: ["channel-status"] });
    },
    onError: () => setNotice({ type: "error", text: "Sync failed. Please retry in a moment." }),
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(filteredFeeds.map((feed) => listingApi.post(`/listings/${feed.listingId}/ical-feeds/${feed.id}/sync`)));
    },
    onSuccess: () => {
      setNotice({ type: "success", text: "Sync started for all visible feeds." });
      queryClient.invalidateQueries({ queryKey: ["channel-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["channel-blocked-dates"] });
    },
    onError: () => setNotice({ type: "error", text: "Some feeds could not be synced." }),
  });

  const filteredFeeds = useMemo(() => {
    const text = search.trim().toLowerCase();
    return feeds
      .filter((feed) => selectedListing === "all" || feed.listingId === selectedListing)
      .filter((feed) => platform === "all" || feed.platform === platform)
      .filter((feed) => status === "all" || feed.status === status)
      .filter((feed) => {
        if (!text) return true;
        return `${feed.name} ${feed.listingName} ${feed.platform} ${feed.feedUrl}`.toLowerCase().includes(text);
      });
  }, [feeds, platform, search, selectedListing, status]);

  const stats = useMemo(() => {
    const total = filteredFeeds.length;
    const active = filteredFeeds.filter((feed) => feed.isActive && feed.status !== "failed").length;
    const failed = filteredFeeds.filter((feed) => feed.status === "failed").length;
    const pending = filteredFeeds.filter((feed) => feed.status === "syncing").length;
    const lastSuccessful = filteredFeeds
      .map((feed) => feed.lastSuccessfulSync ?? feed.lastSyncedAt)
      .filter(Boolean)
      .sort()
      .at(-1);
    return { total, active, failed, pending, lastSuccessful };
  }, [filteredFeeds]);

  const calendarDays = useMemo(() => visibleMonthDays(calendarDate), [calendarDate]);

  const openAddModal = () => {
    setFormError("");
    setForm((current) => ({ ...current, listingId: selectedListing === "all" ? listings[0]?.id ?? "" : selectedListing }));
    setAddModal(true);
  };

  const submitFeed = () => {
    const duplicate = feeds.some((feed) => feed.feedUrl.trim().toLowerCase() === form.feedUrl.trim().toLowerCase());
    if (!form.listingId || !form.name.trim() || !form.feedUrl.trim()) {
      setFormError("Listing, feed title, and URL are required.");
      return;
    }
    if (!isValidUrl(form.feedUrl.trim())) {
      setFormError("Enter a valid http, https, or webcal URL.");
      return;
    }
    if (duplicate) {
      setFormError("This feed URL is already connected.");
      return;
    }
    addFeedMutation.mutate();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Channel Manager"
        subtitle="Connect external iCal feeds, monitor sync health, and prevent double bookings."
        action={
          <div className="flex gap-2">
            <Button variant="outline" icon={<RefreshCw />} loading={feedsFetching && !feedsLoading} onClick={() => queryClient.invalidateQueries({ queryKey: ["channel-feeds"] })}>
              Refresh
            </Button>
            <Button icon={<Plus />} onClick={openAddModal} disabled={listings.length === 0}>
              Add Feed
            </Button>
          </div>
        }
      />

      {notice && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          <span className="flex items-center gap-2">
            {notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {notice.text}
          </span>
          <button className="rounded-lg px-2 py-1 hover:bg-white/70" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Connected Feeds" value={stats.total} icon={<Globe2 />} tone="bg-blue-50 text-blue-700" />
        <StatCard label="Active Feeds" value={channelStatus?.activeFeeds ?? stats.active} icon={<ShieldCheck />} tone="bg-emerald-50 text-emerald-700" />
        <StatCard label="Failed Syncs" value={channelStatus?.failedFeeds ?? stats.failed} icon={<XCircle />} tone="bg-red-50 text-red-700" />
        <StatCard label="Pending Syncs" value={channelStatus?.pendingSyncs ?? stats.pending} icon={<Clock3 />} tone="bg-amber-50 text-amber-700" />
        <StatCard label="Last Success" value={stats.lastSuccessful ? formatRelativeTime(stats.lastSuccessful) : "Never"} icon={<CheckCircle2 />} tone="bg-slate-100 text-slate-700" />
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <Input placeholder="Search feed, listing, or channel" value={search} onChange={(event) => setSearch(event.target.value)} leftIcon={<Search />} />
          <Select value={selectedListing} onChange={(event) => setSelectedListing(event.target.value)} options={listingOptions} placeholder={listingsLoading ? "Loading listings..." : "All listings"} />
          <Select value={platform} onChange={(event) => setPlatform(event.target.value)} options={platforms} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <div className="space-y-5">
          <Card>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Connected Channels</h3>
                <p className="text-xs text-slate-500">Manage feed URLs, health, manual syncs, and connection state.</p>
              </div>
              <Button variant="outline" icon={<RefreshCw />} loading={syncAllMutation.isPending} disabled={filteredFeeds.length === 0} onClick={() => syncAllMutation.mutate()}>
                Sync All
              </Button>
            </div>

            {feedsLoading ? (
              <LoadingCards />
            ) : filteredFeeds.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
                <Link2 className="h-12 w-12 text-slate-300" />
                <p className="mt-4 font-semibold text-slate-900">No connected feeds</p>
                <p className="mt-1 max-w-md text-sm text-slate-500">Connect Airbnb, Booking.com, Google Calendar, or any custom iCal feed to sync blocked dates.</p>
                <Button className="mt-4" icon={<Plus />} onClick={openAddModal} disabled={listings.length === 0}>Add Feed</Button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredFeeds.map((feed) => (
                  <div key={feed.id} className="rounded-xl border border-border p-4 transition-all hover:border-primary/40 hover:shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-slate-950">{feed.name}</p>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize", statusTone(feed.status))}>
                            {feed.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium capitalize text-slate-500">{feed.platform} · {feed.listingName}</p>
                      </div>
                      <div className={cn("h-3 w-3 rounded-full", feed.isActive ? "bg-emerald-500" : "bg-slate-300")} />
                    </div>

                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="truncate font-mono text-xs text-slate-500">{maskUrl(feed.feedUrl)}</p>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <span>Last sync: {feed.lastSyncedAt ? formatRelativeTime(feed.lastSyncedAt) : "Never"}</span>
                      <span>Last success: {feed.lastSuccessfulSync ? formatRelativeTime(feed.lastSuccessfulSync) : "Unknown"}</span>
                    </div>
                    {feed.lastError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{feed.lastError}</p>}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="xs" variant="outline" icon={<RefreshCw />} loading={syncFeedMutation.isPending} onClick={() => syncFeedMutation.mutate(feed)}>
                        Sync Now
                      </Button>
                      <Button size="xs" variant="ghost" icon={<Trash2 />} onClick={() => deleteFeedMutation.mutate(feed)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4">
              <h3 className="font-semibold text-slate-900">Channel Analytics & Health</h3>
              <p className="text-xs text-slate-500">Connection health and sync response summary for the selected listing.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <HealthTile label="Sync Health" value={channelStatus?.health ?? (stats.failed ? "warning" : "connected")} />
              <HealthTile label="Feed Validation" value={stats.failed ? "warning" : "connected"} />
              <HealthTile label="API Response" value={feedsFetching ? "syncing" : "connected"} />
            </div>
          </Card>
        </div>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Blocked Dates</h3>
              <p className="text-xs text-slate-500">{calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="xs" icon={<ChevronLeft />} onClick={() => setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} />
              <Button variant="ghost" size="xs" icon={<ChevronRight />} onClick={() => setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-center text-xs font-semibold text-slate-400">{day}</div>
            ))}
          </div>

          {blockedLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, index) => (
                <div key={index} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayKey = toISODate(day);
                const blocks = blockedDates.filter((blocked) => dateInRange(dayKey, blocked.start, blocked.end));
                const inMonth = day.getMonth() === calendarDate.getMonth();
                return (
                  <div
                    key={dayKey}
                    title={blocks.map((block) => block.reason).join(", ")}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-lg text-sm font-medium",
                      inMonth ? "text-slate-700" : "text-slate-300",
                      blocks.length > 0 ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-slate-50"
                    )}
                  >
                    {day.getDate()}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 space-y-2">
            {blockedDates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-700">No blocked dates</p>
                <p className="text-xs text-slate-500">Synced reservations and unavailable dates will appear here.</p>
              </div>
            ) : (
              blockedDates.slice(0, 5).map((blocked) => (
                <div key={blocked.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{blocked.reason}</p>
                    <p className="text-xs text-slate-500">{formatDate(blocked.start)} to {formatDate(blocked.end)}</p>
                  </div>
                  <Badge label={blocked.source} status="pending" />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Add New iCal Feed</h3>
                <p className="text-sm text-slate-500">Connect an external calendar feed to a listing.</p>
              </div>
              <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" onClick={() => setAddModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {formError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
              <Select
                label="Listing / Property"
                value={form.listingId}
                onChange={(event) => setForm((current) => ({ ...current, listingId: event.target.value }))}
                options={listings.map((listing) => ({ value: listing.id, label: listing.name ?? listing.id }))}
                placeholder="Select listing"
              />
              <Input label="Feed Nickname" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Airbnb Main Calendar" />
              <Select label="Platform" value={form.platform} onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value }))} options={feedPlatforms} />
              <Input label="Feed URL" type="url" value={form.feedUrl} onChange={(event) => setForm((current) => ({ ...current, feedUrl: event.target.value }))} placeholder="https://www.airbnb.com/calendar/ical/..." />
            </div>

            <div className="flex gap-3 border-t border-border p-5">
              <Button variant="outline" className="flex-1" onClick={() => setAddModal(false)}>Cancel</Button>
              <Button className="flex-1" loading={addFeedMutation.isPending} onClick={submitFeed}>Connect Feed</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthTile({ label, value }: { label: string; value: SyncStatus }) {
  return (
    <div className={cn("rounded-xl border p-4", statusTone(value))}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-2 flex items-center gap-2 font-bold capitalize">
        {value === "syncing" ? <Loader2 className="h-4 w-4 animate-spin" /> : value === "failed" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {value}
      </p>
    </div>
  );
}
