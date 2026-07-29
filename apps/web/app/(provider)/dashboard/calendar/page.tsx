"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock3, Gift, Lock, RefreshCw, Tag, Unlock } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatDate } from "@/lib/utils";

type ListingCategory = "hotel" | "apartment" | "car";
type DiscountType = "percentage" | "fixed";

interface Listing {
  id: string;
  name: string;
  category: ListingCategory;
}

interface BookingRange {
  id: string;
  reference: string;
  start: string;
  end: string;
  status: "confirmed" | "pending_payment";
  guestName: string;
  type: "booking";
}

interface ExternalRange {
  id: string;
  start: string;
  end: string;
  summary: string;
  platform: string;
  type: "ical_block";
}

interface FeedStatus {
  id: string;
  platform: string;
  status: "synced" | "error" | "pending";
  lastSyncedAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  nextRetryAt: string | null;
}

interface ManualBlock {
  id: string;
  start: string;
  end: string;
  reason: string;
}

interface ProviderOffer {
  id: string;
  start: string;
  end: string;
  discountType: DiscountType;
  discountValue: number;
  label: string;
}

interface ActivityPromotion {
  id: string;
  start: string;
  end: string;
  label: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function unwrap(payload: unknown) {
  const root = payload as Record<string, unknown>;
  return (root?.data as Record<string, unknown>) ?? root ?? {};
}

function unwrapList(payload: unknown, keys: string[]) {
  const data = unwrap(payload);
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }
  return Array.isArray(payload) ? payload : [];
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toISODate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthRange(date: Date) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: toISODate(from), to: toISODate(to) };
}

function visibleMonthDays(date: Date) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function dateInRange(day: string, start: string, end: string) {
  return day >= toISODate(start) && day <= toISODate(end);
}

function overlaps<T extends { start: string; end: string }>(day: string, ranges: T[]): T[] {
  return ranges.filter((range) => dateInRange(day, range.start, range.end));
}

function normalizeListing(raw: unknown): Listing {
  const item = raw as Record<string, unknown>;
  return {
    id: readString(item.id, crypto.randomUUID()),
    name: readString(item.name, "Untitled listing"),
    category: readString(item.category, "apartment") as ListingCategory,
  };
}

function normalizeBookingRange(raw: unknown): BookingRange | null {
  const item = raw as Record<string, unknown>;
  const start = toISODate(readString(item.start));
  if (!start) return null;
  return {
    id: readString(item.id, crypto.randomUUID()),
    reference: readString(item.reference, "KAIN-XXXX-CC"),
    start,
    end: toISODate(readString(item.end, start)),
    status: readString(item.status, "confirmed") === "pending_payment" ? "pending_payment" : "confirmed",
    guestName: readString(item.guestName, "Guest"),
    type: "booking",
  };
}

function normalizeExternalRange(raw: unknown): ExternalRange {
  const item = raw as Record<string, unknown>;
  return {
    id: readString(item.id, crypto.randomUUID()),
    start: toISODate(readString(item.start ?? item.startDate)),
    end: toISODate(readString(item.end ?? item.endDate ?? item.start ?? item.startDate)),
    summary: readString(item.summary, "External hold"),
    platform: readString(item.platform, "External"),
    type: "ical_block",
  };
}

async function fetchListings() {
  const response = await listingApi.get("/provider/listings/summary");
  return unwrapList(response.data, ["listings", "items", "results"]).map(normalizeListing);
}

async function fetchAvailability(listingId: string, from: string, to: string) {
  const response = await listingApi.get(`/provider/availability/${listingId}`, { params: { from, to } });
  return {
    bookings: unwrapList(response.data, ["bookedRanges"]).map(normalizeBookingRange).filter((item): item is BookingRange => Boolean(item)),
    externalHolds: unwrapList(response.data, ["blockedRanges"]).map(normalizeExternalRange),
  };
}

async function fetchFeeds(listingId: string) {
  const response = await listingApi.get(`/listings/${listingId}/channel-status`);
  return unwrapList(response.data, ["channels"]).map((raw) => {
    const item = raw as Record<string, unknown>;
    return {
      id: readString(item.id, crypto.randomUUID()),
      platform: readString(item.platform, "External"),
      status: readString(item.status, "pending") as FeedStatus["status"],
      lastSyncedAt: readString(item.lastSyncedAt) || null,
      lastError: readString(item.lastError) || null,
      consecutiveFailures: readNumber(item.consecutiveFailures),
      nextRetryAt: readString(item.nextRetryAt) || null,
    };
  });
}

function activeLock(range: BookingRange) {
  return range.status === "pending_payment";
}

function feedWarning(feed: FeedStatus) {
  if (feed.status === "error") return true;
  if (!feed.lastSyncedAt) return false;
  const lastSync = new Date(feed.lastSyncedAt).getTime();
  return Number.isFinite(lastSync) && Date.now() - lastSync > 30 * 60 * 1000;
}

function LegendItem({ className, label, detail }: { className: string; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-4 w-4 rounded border border-slate-200", className)} />
      <span className="text-xs text-slate-600"><span className="font-semibold text-slate-800">{label}</span> {detail}</span>
    </div>
  );
}

function isoRange(from: string, to: string) {
  if (!from || !to) return "Select a date range";
  return `${formatDate(from)} to ${formatDate(to)}`;
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const initialListing = searchParams.get("listing") ?? "";
  const [cursor, setCursor] = useState(new Date());
  const [selectedListing, setSelectedListing] = useState(initialListing);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [blockReason, setBlockReason] = useState("Provider block");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState("20");
  const [offerLabel, setOfferLabel] = useState("20%");
  const [manualBlocks, setManualBlocks] = useState<ManualBlock[]>([]);
  const [providerOffers, setProviderOffers] = useState<ProviderOffer[]>([]);
  const [activityPromotions] = useState<ActivityPromotion[]>([]);

  const dateRange = useMemo(() => monthRange(cursor), [cursor]);
  const visibleDays = useMemo(() => visibleMonthDays(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["provider-calendar-listings"],
    queryFn: fetchListings,
  });

  useEffect(() => {
    if (!selectedListing && listings[0]) setSelectedListing(listings[0].id);
  }, [listings, selectedListing]);

  const selectedListingRecord = listings.find((listing) => listing.id === selectedListing);

  const { data: availability = { bookings: [], externalHolds: [] }, isLoading: availabilityLoading } = useQuery({
    queryKey: ["provider-calendar-availability", selectedListing, dateRange],
    queryFn: () => fetchAvailability(selectedListing, dateRange.from, dateRange.to),
    enabled: Boolean(selectedListing),
  });

  const { data: feeds = [], isLoading: feedsLoading, refetch: refetchFeeds, isFetching: feedsFetching } = useQuery({
    queryKey: ["provider-calendar-feeds", selectedListing],
    queryFn: () => fetchFeeds(selectedListing),
    enabled: Boolean(selectedListing),
  });

  const selectedBlocks = manualBlocks.filter((block) => block.id.startsWith(`${selectedListing}:`));
  const selectedOffers = providerOffers.filter((offer) => offer.id.startsWith(`${selectedListing}:`));
  const loading = listingsLoading || availabilityLoading;

  function normalizedSelectedRange() {
    if (!rangeStart || !rangeEnd) return null;
    return rangeStart <= rangeEnd ? { start: rangeStart, end: rangeEnd } : { start: rangeEnd, end: rangeStart };
  }

  function handleDayClick(day: string) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd("");
      return;
    }
    setRangeEnd(day);
  }

  function blockDates() {
    const range = normalizedSelectedRange();
    if (!selectedListing || !range) return;
    setManualBlocks((items) => [
      ...items.filter((item) => !(item.id.startsWith(`${selectedListing}:`) && item.start === range.start && item.end === range.end)),
      { id: `${selectedListing}:block:${range.start}:${range.end}`, ...range, reason: blockReason || "Provider block" },
    ]);
  }

  function unblockDates() {
    const range = normalizedSelectedRange();
    if (!selectedListing || !range) return;
    setManualBlocks((items) => items.filter((item) => !(item.id.startsWith(`${selectedListing}:`) && item.start <= range.end && item.end >= range.start)));
  }

  function activateOffer() {
    const range = normalizedSelectedRange();
    const value = Number(discountValue);
    if (!selectedListing || !range || !Number.isFinite(value) || value <= 0) return;
    setProviderOffers((items) => [
      ...items.filter((item) => !(item.id.startsWith(`${selectedListing}:`) && item.start === range.start && item.end === range.end)),
      {
        id: `${selectedListing}:offer:${range.start}:${range.end}`,
        ...range,
        discountType,
        discountValue: value,
        label: offerLabel.slice(0, 6) || `${value}${discountType === "percentage" ? "%" : ""}`.slice(0, 6),
      },
    ]);
  }

  function removeOffer() {
    const range = normalizedSelectedRange();
    if (!selectedListing || !range) return;
    setProviderOffers((items) => items.filter((item) => !(item.id.startsWith(`${selectedListing}:`) && item.start <= range.end && item.end >= range.start)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">Activate and deactivate availability or provider offers by date for one listing.</p>
        </div>
        <div className="w-full lg:w-80">
          <Select
            label="Listing"
            value={selectedListing}
            onChange={(event) => {
              setSelectedListing(event.target.value);
              setRangeStart("");
              setRangeEnd("");
            }}
            placeholder={listingsLoading ? "Loading listings..." : "Select listing"}
            options={listings.map((listing) => ({ value: listing.id, label: `${listing.name} (${listing.category})` }))}
          />
        </div>
      </div>

      <Card>
        <SectionHeader
          title={selectedListingRecord ? `${selectedListingRecord.name} Calendar` : "Listing Calendar"}
          subtitle="Monthly availability view scoped to this provider listing."
          action={<Badge label={selectedListingRecord?.category ?? "listing"} />}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <LegendItem className="bg-white" label="Available" detail="Unit open to book" />
          <LegendItem className="bg-emerald-600" label="Booked" detail="Confirmed booking occupying date" />
          <LegendItem className="bg-amber-400" label="Held" detail="Active 5-minute reservation lock" />
          <LegendItem className="bg-slate-700" label="Blocked" detail="Manually blocked by provider" />
          <LegendItem className="bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_6px,#f8fafc_6px,#f8fafc_12px)]" label="External hold" detail="Imported iCal feed block" />
          <LegendItem className="bg-white" label="Promotion active" detail="Red badge on date" />
          <LegendItem className="bg-white" label="Provider offer" detail="Orange badge on date" />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setCursor((value) => addMonths(value, -1))} />
              <div>
                <h2 className="text-base font-bold text-slate-950">{monthLabel}</h2>
                <p className="text-xs text-slate-500">{dateRange.from} to {dateRange.to}</p>
              </div>
              <Button variant="ghost" icon={<ChevronRight />} onClick={() => setCursor((value) => addMonths(value, 1))} />
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              Selected: {isoRange(rangeStart, rangeEnd)}
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 42 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-100" />)}
              </div>
            ) : !selectedListing ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center">
                <CalendarDays className="h-12 w-12 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-900">Select a listing</p>
                <p className="mt-1 text-sm text-slate-500">A monthly listing calendar will appear here.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 border-y border-slate-200 bg-slate-50">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-slate-500">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {visibleDays.map((date) => {
                    const day = toISODate(date);
                    const bookings = overlaps(day, availability.bookings);
                    const holds = bookings.filter(activeLock);
                    const confirmed = bookings.filter((booking) => booking.status === "confirmed");
                    const externalHolds = overlaps(day, availability.externalHolds);
                    const blocks = overlaps(day, selectedBlocks);
                    const offers = overlaps(day, selectedOffers);
                    const promotions = overlaps(day, activityPromotions);
                    const selectedRange = normalizedSelectedRange();
                    const isSelected = selectedRange ? day >= selectedRange.start && day <= selectedRange.end : day === rangeStart;
                    const outsideMonth = date.getMonth() !== cursor.getMonth();

                    let stateClass = "bg-white text-slate-800";
                    if (externalHolds.length) stateClass = "bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_8px,#f8fafc_8px,#f8fafc_16px)] text-slate-700";
                    if (blocks.length) stateClass = "bg-slate-700 text-white";
                    if (holds.length) stateClass = "bg-amber-400 text-slate-950";
                    if (confirmed.length) stateClass = "bg-emerald-600 text-white";

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "relative min-h-[116px] border-b border-r border-slate-200 p-2 text-left transition hover:ring-2 hover:ring-green-300",
                          stateClass,
                          outsideMonth && "opacity-40",
                          isSelected && "ring-2 ring-green-800"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm font-bold text-slate-950">{date.getDate()}</span>
                          <div className="flex flex-wrap justify-end gap-1">
                            {promotions[0] && <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{promotions[0].label}</span>}
                            {offers[0] && <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{offers[0].label}</span>}
                          </div>
                        </div>
                        <div className="mt-2 space-y-1">
                          {confirmed.slice(0, 2).map((booking) => <p key={booking.id} className="truncate rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold">{booking.reference}</p>)}
                          {holds.slice(0, 1).map((booking) => <p key={booking.id} className="truncate rounded bg-white/40 px-2 py-0.5 text-[10px] font-semibold">Held {booking.reference}</p>)}
                          {blocks[0] && <p className="truncate rounded bg-black/20 px-2 py-0.5 text-[10px] font-semibold">{blocks[0].reason}</p>}
                          {externalHolds[0] && <p className="truncate rounded bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{externalHolds[0].platform}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionHeader title="Calendar Actions" subtitle="Select a date range, then choose an action." />
            <div className="grid gap-3">
              <Input label="Start Date" type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
              <Input label="End Date" type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
              <Input label="Block Reason" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Button icon={<Lock />} onClick={blockDates} disabled={!normalizedSelectedRange()}>Block Dates</Button>
                <Button variant="outline" icon={<Unlock />} onClick={unblockDates} disabled={!normalizedSelectedRange()}>Unblock Dates</Button>
              </div>
              <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                Blocking dates marks them unavailable in this calendar. The live iCal export endpoint publishes confirmed busy periods; manual busy-block persistence is not present in the current API schema.
              </p>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Provider Offer" subtitle="Custom date-range discount for this listing." />
            <div className="grid gap-3">
              <Select
                label="Discount Type"
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value as DiscountType)}
                options={[
                  { value: "percentage", label: "Percentage" },
                  { value: "fixed", label: "Fixed" },
                ]}
              />
              <Input label="Discount Value" type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
              <Input label="Label Text" maxLength={6} value={offerLabel} onChange={(event) => setOfferLabel(event.target.value.slice(0, 6))} />
              <div className="grid grid-cols-2 gap-2">
                <Button icon={<Tag />} onClick={activateOffer} disabled={!normalizedSelectedRange()}>Activate Offer</Button>
                <Button variant="outline" icon={<Gift />} onClick={removeOffer} disabled={!normalizedSelectedRange()}>Remove Offer</Button>
              </div>
              <p className="rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-800">
                Provider offers are shown as orange badges and are separate from admin activity promotions.
              </p>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Sync Status"
              subtitle="Connected OTA feed status for this listing."
              action={<Button size="sm" variant="ghost" icon={<RefreshCw />} loading={feedsFetching} onClick={() => refetchFeeds()} />}
            />
            {feedsLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ) : feeds.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No connected OTA feeds for this listing.</div>
            ) : (
              <div className="space-y-3">
                {feeds.map((feed) => {
                  const warn = feedWarning(feed);
                  return (
                    <div key={feed.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{feed.platform}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Last synced: {feed.lastSyncedAt ? formatDate(feed.lastSyncedAt) : "Not synced yet"}
                          </p>
                        </div>
                        <Badge label={warn ? "Sync warning" : feed.status} status={warn ? "failed" : feed.status} />
                      </div>
                      {warn && (
                        <p className="mt-2 flex gap-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          Sync has failed or is older than 30 minutes.
                        </p>
                      )}
                      {feed.lastError && <p className="mt-2 text-xs text-red-600">{feed.lastError}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 text-slate-500" />
              <div>
                <p className="font-semibold text-slate-900">External pickup window</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">External channels should pick up busy VEVENT changes within 15 minutes once exported by the iCal feed.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
