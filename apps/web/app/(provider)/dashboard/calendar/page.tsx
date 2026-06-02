"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Lock, BookOpen } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import type { Listing, AvailabilityRange } from "@/types/provider";

const fetchListings = () =>
  listingApi
    .get("/listings?status=active&limit=50")
    .then((r) => (r.data.data ?? r.data).listings ?? []);

const fetchAvailability = (listingId: string, from: string, to: string) =>
  listingApi
    .get(`/provider/availability/${listingId}?from=${from}&to=${to}`)
    .then((r) => r.data.data ?? r.data);

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeContains(start: string, end: string, day: string) {
  return day >= start && day <= end;
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default function CalendarPage() {
  const [selectedListing, setSelectedListing] = useState<string>("");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["provider-calendar-listings"],
    queryFn:  fetchListings,
  });

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const fromStr  = isoDate(firstDay);
  const toStr    = isoDate(lastDay);

  const { data: availData, isLoading } = useQuery({
    queryKey: ["provider-availability", selectedListing, fromStr, toStr],
    queryFn:  () => selectedListing ? fetchAvailability(selectedListing, fromStr, toStr) : null,
    enabled:  !!selectedListing,
  });

  const bookedRanges: AvailabilityRange[] = availData?.bookedRanges ?? [];
  const blockedRanges: AvailabilityRange[] = availData?.blockedRanges ?? [];

  const days = getDaysInMonth(year, month);
  const startPad = firstDay.getDay();

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const getDayStatus = (d: Date) => {
    const ds = isoDate(d);
    if (bookedRanges.some((r) => rangeContains(r.start!, r.end!, ds))) return "booked";
    if (blockedRanges.some((r) => rangeContains(r.start, r.end, ds))) return "blocked";
    return "available";
  };

  const getDayTooltip = (d: Date) => {
    const ds = isoDate(d);
    const booking = bookedRanges.find((r) => rangeContains(r.start!, r.end!, ds));
    if (booking) return `${booking.guestName ?? "Guest"} (${booking.reference ?? ""})`;
    const block = blockedRanges.find((r) => rangeContains(r.start, r.end, ds));
    if (block) return `Blocked: ${block.platform ?? "manual"} ${block.summary ? `— ${block.summary}` : ""}`;
    return "";
  };

  const dayColors: Record<string, string> = {
    booked:    "bg-primary text-white rounded-lg",
    blocked:   "bg-slate-200 text-slate-500 rounded-lg line-through",
    available: "hover:bg-surface-muted rounded-lg",
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Availability Calendar"
        subtitle="View booked and blocked dates for your listings"
      />

      <Card>
        <div className="max-w-sm">
          <Select
            label="Select Listing"
            value={selectedListing}
            onChange={(e) => setSelectedListing(e.target.value)}
            options={listings.map((l: Listing) => ({ value: l.id, label: l.name ?? l.id }))}
            placeholder="Choose a listing…"
          />
        </div>
      </Card>

      {selectedListing && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-5">
              <Button variant="ghost" icon={<ChevronLeft />} onClick={prevMonth} />
              <h2 className="text-lg font-bold text-slate-900">{MONTHS[month]} {year}</h2>
              <Button variant="ghost" icon={<ChevronRight />} onClick={nextMonth} />
            </div>

            <div className="flex items-center gap-4 mb-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-primary" />
                Booked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-slate-200" />
                Blocked (iCal)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-surface-muted border border-border" />
                Available
              </span>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-lg animate-shimmer" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPad }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {days.map((d) => {
                  const status = getDayStatus(d);
                  const tooltip = getDayTooltip(d);
                  const isToday = isoDate(d) === isoDate(new Date());
                  return (
                    <div
                      key={isoDate(d)}
                      title={tooltip}
                      className={`
                        h-10 flex flex-col items-center justify-center cursor-default transition-all
                        ${dayColors[status]}
                        ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                      `}
                    >
                      <span className="text-sm font-medium">{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {bookedRanges.length > 0 && (
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-slate-900">Booked Ranges This Month</h3>
              </div>
              <div className="space-y-2">
                {bookedRanges.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{r.guestName ?? "Guest"}</p>
                        <p className="text-xs text-slate-500">{formatDate(r.start)} → {formatDate(r.end)}</p>
                      </div>
                    </div>
                    <Badge label={r.status ?? "confirmed"} status={r.status ?? "confirmed"} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {blockedRanges.length > 0 && (
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-slate-900">Blocked Ranges This Month (iCal)</h3>
              </div>
              <div className="space-y-2">
                {blockedRanges.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-semibold text-slate-700 capitalize">{r.platform}</p>
                        <p className="text-xs text-slate-400">{formatDate(r.start)} → {formatDate(r.end)}</p>
                        {r.summary && <p className="text-xs text-slate-500 mt-0.5">{r.summary}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
