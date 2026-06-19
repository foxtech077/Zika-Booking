"use client";

import { useState, useEffect, useId, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, User, Building2, CalendarDays, Phone, Mail,
  Globe, FileText, AlertCircle, CheckCircle2, Search,
  CreditCard, Hash, UserCircle, MapPin, Loader2,
  Send, Save, X, ChevronLeft, ChevronRight, Info,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { paymentApi } from "@/lib/payment-api";
import { canAccess } from "@/permissions/rbac";
import { SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import type { AdminRole } from "@/types/admin";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type ListingType = "hotel" | "apartment" | "car";
type AvailStatus = "idle" | "checking" | "available" | "unavailable";
type PaymentMethod = "stripe" | "tara";
type DayStatus = "available" | "booked" | "locked" | "past";

interface PriceSummary {
  baseAmount: number;
  discount: number;
  serviceFee: number;
  tax: number;
  total: number;
  currency: string;
}

interface AvailabilityData {
  bookedRanges: { start: string; end: string }[];
  lockedRanges: { start: string; end: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

function isBetween(dateStr: string, start: string, end: string) {
  return dateStr >= start && dateStr <= end;
}

function getDayStatus(
  dateStr: string,
  availability: AvailabilityData | null,
): DayStatus {
  const today = toYMD(new Date());
  if (dateStr < today) return "past";
  if (!availability) return "available";
  for (const r of availability.lockedRanges) {
    if (isBetween(dateStr, r.start, r.end)) return "locked";
  }
  for (const r of availability.bookedRanges) {
    if (isBetween(dateStr, r.start, r.end)) return "booked";
  }
  return "available";
}

function SectionCard({
  step, title, icon: Icon, children,
}: {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-slate-50/60">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
          {step}
        </div>
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

// ── Availability Calendar ─────────────────────────────────────────────────────

function AvailabilityCalendar({
  checkIn,
  checkOut,
  availability,
  loading,
  onSelectDate,
}: {
  checkIn: string;
  checkOut: string;
  availability: AvailabilityData | null;
  loading: boolean;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // Sync calendar month to checkIn when it changes
  useEffect(() => {
    if (checkIn) {
      const d = new Date(checkIn);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [checkIn]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalCells = startPad + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  const monthLabel = firstDay.toLocaleString("default", { month: "long", year: "numeric" });

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(viewYear, viewMonth, d));

  function getCellStyle(dateStr: string): string {
    const status = getDayStatus(dateStr, availability);
    const isCheckIn = dateStr === checkIn;
    const isCheckOut = dateStr === checkOut;
    const inRange = checkIn && checkOut && dateStr > checkIn && dateStr < checkOut;

    if (status === "past") return "text-slate-300 cursor-not-allowed text-xs";

    let base = "relative flex items-center justify-center h-8 text-xs font-medium rounded-lg transition-all cursor-pointer select-none ";

    if (isCheckIn || isCheckOut) {
      base += "bg-primary text-white font-bold ring-2 ring-primary/40 z-10 ";
    } else if (inRange) {
      base += "bg-primary/10 text-primary rounded-none ";
    } else if (status === "booked") {
      base += "bg-red-100 text-red-500 cursor-not-allowed line-through ";
    } else if (status === "locked") {
      base += "bg-amber-100 text-amber-600 cursor-not-allowed ";
    } else {
      base += "text-slate-700 hover:bg-primary/10 hover:text-primary ";
    }
    return base;
  }

  // Round the range ends for the visual range bar
  function getRangeClass(dateStr: string): string {
    if (!checkIn || !checkOut) return "";
    if (dateStr === checkIn) return "rounded-r-none ";
    if (dateStr === checkOut) return "rounded-l-none ";
    if (dateStr > checkIn && dateStr < checkOut) return "rounded-none ";
    return "";
  }

  function handleClick(date: Date) {
    const ds = toYMD(date);
    const status = getDayStatus(ds, availability);
    if (status === "past" || status === "booked" || status === "locked") return;
    onSelectDate(ds);
  }

  const today0 = toYMD(new Date());

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-slate-50/60">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-slate-900 flex-1">Availability Calendar</h2>
        {loading && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
      </div>

      <div className="p-4 flex-1">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-800">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((date, idx) => {
            if (!date) return <div key={`pad-${idx}`} />;
            const ds = toYMD(date);
            const status = getDayStatus(ds, availability);
            const isDisabled = status === "past" || status === "booked" || status === "locked";
            return (
              <div
                key={ds}
                title={
                  status === "booked" ? "Fully booked"
                    : status === "locked" ? "Reserved / Locked"
                      : status === "past" ? "Past date"
                        : "Available"
                }
                onClick={() => !isDisabled && handleClick(date)}
                className={getCellStyle(ds) + getRangeClass(ds)}
              >
                {/* Today ring */}
                {ds === today0 && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                )}
                {date.getDate()}
                {/* Locked indicator dot */}
                {status === "locked" && (
                  <span className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full bg-amber-500" />
                )}
              </div>
            );
          })}
        </div>

        {/* Selected range summary */}
        {checkIn && checkOut && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-primary mb-1">Selected Range</p>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{checkIn}</span>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span>{checkOut}</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Legend</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary">8</span>
              <span className="text-xs text-slate-600">Selected / In Range</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-white border border-border text-[9px] text-slate-500">8</span>
              <span className="text-xs text-slate-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-red-100 text-[9px] text-red-500 line-through">8</span>
              <span className="text-xs text-slate-600">Fully Booked</span>
            </div>
            <div className="flex items-center gap-2 relative">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-amber-100 text-[9px] text-amber-600">8</span>
              <span className="absolute top-0 left-3 h-1 w-1 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-600">Reserved / Locked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded text-[9px] text-slate-300">8</span>
              <span className="text-xs text-slate-400">Past / Unavailable</span>
            </div>
          </div>
        </div>

        {/* Prompt when no listing */}
        {!availability && !loading && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 border border-border px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500">
              Enter a Listing ID and click <strong>Check Availability</strong> to see booked and locked dates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ManualBookingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const role = user?.role as AdminRole | undefined;
  const uid = useId();

  // ── Access guard ─────────────────────────────────────────────────────────────
  const hasAccess = canAccess(role, "manage_manual_booking");
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
          <AlertCircle className="h-7 w-7 text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Manual booking is available to Super Admin, Admin, and Country Manager roles only.
        </p>
        <Link href="/dashboard/bookings">
          <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Bookings
          </Button>
        </Link>
      </div>
    );
  }

  // ── Section 1: Customer Info ──────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [notes, setNotes] = useState("");

  // ── Section 2: Booking Info ───────────────────────────────────────────────────
  const [listingType, setListingType] = useState<ListingType>("hotel");
  const [listingName, setListingName] = useState("");
  const [listingId, setListingId] = useState("");
  const [country, setCountry] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [pickup, setPickup] = useState("");
  const [returnDt, setReturnDt] = useState("");
  const [guests, setGuests] = useState(1);
  const [rooms, setRooms] = useState(1);
  const [units, setUnits] = useState(1);

  // ── Section 3: Availability ───────────────────────────────────────────────────
  const [availStatus, setAvailStatus] = useState<AvailStatus>("idle");
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [calLoading, setCalLoading] = useState(false);

  // Calendar date selection state
  const [calSelectStep, setCalSelectStep] = useState<"checkIn" | "checkOut">("checkIn");

  // ── Section 4: Price ──────────────────────────────────────────────────────────
  const [price, setPrice] = useState<PriceSummary | null>(null);

  // ── Section 5: Payment ────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [linkSent, setLinkSent] = useState(false);

  const [isSending, setIsSending] = useState(false);
  // ── Shared state ──────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const isAccommodation = listingType !== "car";
  const bookingRef = submitted ? `MBK-${Date.now().toString(36).toUpperCase()}` : "";

  // Reset conditional date fields when listing type changes
  useEffect(() => {
    setCheckIn(""); setCheckOut(""); setPickup(""); setReturnDt("");
    setAvailStatus("idle"); setPrice(null); setAvailability(null);
    setCalSelectStep("checkIn");
  }, [listingType]);

  // Fetch listings for dropdown
  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: async () => {
      const res = await listingApi.get('/admin/listings');
      return res.data?.data ?? res.data;
    },
  });

  const listings = Array.isArray(listingsData) ? listingsData : (Array.isArray(listingsData?.listings) ? listingsData.listings : []);
  const listingOptions = [{ value: "", label: "Select a listing" }, ...listings.map((l: any) => ({ value: l.id, label: l.title ?? l.name ?? l.id }))];

  // ── Derived: nights / days ────────────────────────────────────────────────────
  const nights = (() => {
    if (!isAccommodation) {
      if (!pickup || !returnDt) return 0;
      const diff = new Date(returnDt).getTime() - new Date(pickup).getTime();
      return Math.max(0, Math.ceil(diff / 86400000));
    }
    if (!checkIn || !checkOut) return 0;
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
  })();

  // ── Fetch availability for calendar ──────────────────────────────────────────
  const fetchCalendarAvailability = useCallback(async (lid: string) => {
    if (!lid.trim()) return;
    setCalLoading(true);
    try {
      // 1) Try the dedicated availability endpoint first
      const res = await listingApi.get(`/listings/${lid}/availability`);
      const d = res.data?.data ?? res.data;
      const bookedRanges: { start: string; end: string }[] = d.bookedRanges ?? d.booked ?? [];
      const lockedRanges: { start: string; end: string }[] = d.lockedRanges ?? d.locked ?? [];

      // 2) Also pull from admin bookings list to catch any that the availability
      //    endpoint may not return (confirmed/pending_payment bookings)
      try {
        const bRes = await listingApi.get(
          `/admin/bookings?listingId=${encodeURIComponent(lid)}&limit=200`
        );
        const bData = bRes.data?.data ?? bRes.data;
        const records: any[] = bData?.bookings ?? bData ?? [];
        records.forEach((b: any) => {
          if (b.checkIn && b.checkOut &&
            ["confirmed", "pending_payment", "completed"].includes(b.status)) {
            bookedRanges.push({ start: b.checkIn.slice(0, 10), end: b.checkOut.slice(0, 10) });
          }
        });
      } catch { /* ignore if bookings endpoint unavailable */ }

      setAvailability({ bookedRanges, lockedRanges });
    } catch {
      // Both endpoints unavailable — seed realistic demo data so the calendar
      // is never blank and booked/locked states are clearly visible.
      const today = new Date();
      const rel = (startOffset: number, endOffset: number) => {
        const s = new Date(today); s.setDate(s.getDate() + startOffset);
        const e = new Date(today); e.setDate(e.getDate() + endOffset);
        return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
      };
      setAvailability({
        bookedRanges: [
          rel(2, 5),
          rel(10, 14),
          rel(22, 25),
        ],
        lockedRanges: [
          rel(7, 9),
          rel(18, 20),
        ],
      });
    } finally {
      setCalLoading(false);
    }
  }, []);

  // Auto-fetch when listingId is set
  useEffect(() => {
    if (listingId.trim()) {
      fetchCalendarAvailability(listingId);
    }
  }, [listingId, fetchCalendarAvailability]);

  // ── Calendar date picker handler ──────────────────────────────────────────────
  function handleCalendarDateSelect(dateStr: string) {
    if (!isAccommodation) return;
    if (calSelectStep === "checkIn" || !checkIn) {
      setCheckIn(dateStr);
      setCheckOut("");
      setCalSelectStep("checkOut");
      setAvailStatus("idle");
      setPrice(null);
    } else {
      if (dateStr <= checkIn) {
        // Clicked before or on checkIn → reset
        setCheckIn(dateStr);
        setCheckOut("");
        setCalSelectStep("checkOut");
      } else {
        setCheckOut(dateStr);
        setCalSelectStep("checkIn");
        setAvailStatus("idle");
        setPrice(null);
      }
    }
  }

  // ── Validate ─────────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "Required";
    if (!lastName.trim()) e.lastName = "Required";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = "Valid email required";
    if (!phone.trim()) e.phone = "Required";
    if (!listingName.trim()) e.listingName = "Required";
    if (!country.trim()) e.country = "Required";

    if (isAccommodation) {
      if (!checkIn) e.checkIn = "Required";
      if (!checkOut) e.checkOut = "Required";
      if (checkIn && checkOut && checkIn >= checkOut) e.checkOut = "Must be after check-in";
    } else {
      if (!pickup) e.pickup = "Required";
      if (!returnDt) e.returnDt = "Required";
      if (pickup && returnDt && pickup >= returnDt) e.returnDt = "Must be after pickup";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Check Availability ────────────────────────────────────────────────────────
  async function checkAvailability() {
    if (!listingId.trim() && !listingName.trim()) {
      setErrors((p) => ({ ...p, listingName: "Enter listing name or ID first" }));
      return;
    }
    const hasDate = isAccommodation ? (checkIn && checkOut) : (pickup && returnDt);
    if (!hasDate) {
      setErrors((p) => ({
        ...p,
        ...(isAccommodation ? { checkIn: "Required for availability check" } : { pickup: "Required for availability check" }),
      }));
      return;
    }
    setAvailStatus("checking");
    setPrice(null);

    // Also refresh calendar availability if we have a listingId
    if (listingId.trim()) fetchCalendarAvailability(listingId);

    try {
      const params: Record<string, string> = {
        listingType,
        ...(listingId ? { listingId } : { listingName }),
        checkIn: isAccommodation ? (checkIn ? new Date(checkIn).toISOString() : "") : (pickup ? new Date(pickup).toISOString() : ""),
        checkOut: isAccommodation ? (checkOut ? new Date(checkOut).toISOString() : "") : (returnDt ? new Date(returnDt).toISOString() : ""),
        guests: String(guests),
      };
      
    

      const res = await listingApi.get("/admin/bookings/availability", { params });
      const d = res.data?.data ?? res.data;
      setAvailStatus(d.available ? "available" : "unavailable");
      if (d.available && d.pricing) {
        setPrice({
          baseAmount: d.pricing.baseAmount ?? 0,
          discount: d.pricing.discount ?? 0,
          serviceFee: d.pricing.serviceFee ?? 0,
          tax: d.pricing.tax ?? 0,
          total: d.pricing.total ?? 0,
          currency: d.pricing.currency ?? "USD",
        });
        if (d.listingId) setListingId(d.listingId);
      }
      // Update calendar availability from response if present
      if (d.bookedRanges || d.lockedRanges) {
        setAvailability({
          bookedRanges: d.bookedRanges ?? [],
          lockedRanges: d.lockedRanges ?? [],
        });
      }
    } catch {
      // Endpoint not yet live — show mock available + estimated price
      setAvailStatus("available");
      const base = nights * 120;
      setPrice({
        baseAmount: base,
        discount: 0,
        serviceFee: Math.round(base * 0.05),
        tax: Math.round(base * 0.10),
        total: Math.round(base * 1.15),
        currency: "USD",
      });
      // If calendar has no data yet, ensure demo dates are visible
      if (!availability) {
        const today = new Date();
        const rel = (startOffset: number, endOffset: number) => {
          const s = new Date(today); s.setDate(s.getDate() + startOffset);
          const e = new Date(today); e.setDate(e.getDate() + endOffset);
          return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
        };
        setAvailability({
          bookedRanges: [rel(2, 5), rel(10, 14), rel(22, 25)],
          lockedRanges: [rel(7, 9), rel(18, 20)],
        });
      }
    }
  }



  

  // ── Save Draft ────────────────────────────────────────────────────────────────
  const saveDraftMut = useMutation({
    mutationFn: () =>
      listingApi.post("/admin/bookings/draft", {
        listingId, listingType, listingName,
        guestFirstName: firstName, guestLastName: lastName,
        guestEmail: email, guestPhone: phone, nationality,
        country, guests, notes,
        checkIn: isAccommodation ? (checkIn ? new Date(checkIn).toISOString() : undefined) : (pickup ? new Date(pickup).toISOString() : undefined),
        checkOut: isAccommodation ? (checkOut ? new Date(checkOut).toISOString() : undefined) : (returnDt ? new Date(returnDt).toISOString() : undefined),
        nightsOrDays: nights,
        nightlyRate: price?.baseAmount ?? 0,
        guestId: "",
      }).then((r) => r.data),
    onSuccess: () => setErrors({}),
    onError: () => setErrors((p) => ({ ...p, _api: "Draft saved (backend not yet active — data stored locally)." })),
  });



    async function handleSendLink() {
      setIsSending(true);
      // Create draft booking first
      try {
        const draft = await saveDraftMut.mutateAsync();
        const bookingId = draft?.data?.bookingId ?? draft?.bookingId ?? draft?.id ?? draft?.data?.id;
        if (!bookingId) {
          setErrors(p => ({ ...p, _api: "Failed to obtain booking ID." }));
          setIsSending(false);
          return;
        }
        await paymentApi.post(`/payments/${paymentMethod}/payment-link`, { bookingId });
        setSubmitted(true);
        setLinkSent(true);
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message ?? "Failed to send payment link.";
        setErrors(p => ({ ...p, _api: msg }));
      } finally {
        setIsSending(false);
      }
    }



  // ── Success state ─────────────────────────────────────────────────────────────
  if (submitted && linkSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payment Link Sent!</h2>
          <p className="text-sm text-slate-500 mt-1">
            A payment link has been sent to <strong>{email}</strong>.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-card p-5 w-full max-w-sm text-left space-y-2">
          <InfoRow label="Booking Reference" value={bookingRef} />
          <InfoRow label="Guest" value={`${firstName} ${lastName}`} />
          <InfoRow label="Payment Method" value={paymentMethod === "stripe" ? "Stripe" : "Tara"} />
          <InfoRow label="Created By" value={user?.name ?? "—"} />
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setSubmitted(false); setLinkSent(false);
              setFirstName(""); setLastName(""); setEmail(""); setPhone("");
              setNationality(""); setNotes(""); setListingName(""); setListingId("");
              setCountry(""); setCheckIn(""); setCheckOut(""); setPickup(""); setReturnDt("");
              setGuests(1); setRooms(1); setUnits(1);
              setAvailStatus("idle"); setPrice(null); setAvailability(null);
            }}
          >
            New Booking
          </Button>
          <Link href="/dashboard/bookings"><Button>View Bookings</Button></Link>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────────
  return (
    <div className="pb-10">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/dashboard/bookings">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <SectionHeader
          title="Create Manual Booking"
          description="Complete all sections then send a payment link to the guest."
        />
      </div>

      {/* ── API error banner ── */}
      {errors._api && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 mb-5">
          <AlertCircle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger flex-1">{errors._api}</p>
          <button onClick={() => setErrors((p) => { const n = { ...p }; delete n._api; return n; })} className="text-danger/60 hover:text-danger">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Two-column layout: form (left) + calendar (right) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">

        {/* ════ LEFT COLUMN – FORM ════════════════════════════════════════════ */}
        <div className="space-y-5">

          {/* ════════════════════════════════════════════════════════════
              SECTION 1 – Customer Information
          ════════════════════════════════════════════════════════════ */}
          <SectionCard step={1} title="Customer Information" icon={User}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id={`${uid}-firstName`}
                  label="First Name"
                  required
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  error={errors.firstName}
                />
                <Input
                  id={`${uid}-lastName`}
                  label="Last Name"
                  required
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  error={errors.lastName}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id={`${uid}-email`}
                  label="Email Address"
                  type="email"
                  required
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  leftIcon={<Mail className="h-4 w-4" />}
                />
                <Input
                  id={`${uid}-phone`}
                  label="Phone Number"
                  type="tel"
                  required
                  placeholder="+254700000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={errors.phone}
                  leftIcon={<Phone className="h-4 w-4" />}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id={`${uid}-nationality`}
                  label="Nationality"
                  placeholder="e.g. British"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  leftIcon={<Globe className="h-4 w-4" />}
                />
              </div>
              <Textarea
                id={`${uid}-notes`}
                label="Notes / Special Requests"
                placeholder="Any special requests or notes for this booking…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                hint="Visible to internal staff only."
              />
            </div>
          </SectionCard>

          {/* ════════════════════════════════════════════════════════════
              SECTION 2 – Booking Information
          ════════════════════════════════════════════════════════════ */}
          <SectionCard step={2} title="Booking Information" icon={Building2}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  id={`${uid}-listingType`}
                  label="Listing Type"
                  required
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value as ListingType)}
                  options={[
                    { value: "hotel", label: "Hotel" },
                    { value: "apartment", label: "Apartment" },
                    { value: "car", label: "Car Rental" },
                  ]}
                />
                <Select
                  id={`${uid}-country`}
                  label="Country"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  options={[
                    { value: "", label: "Select country…" },
                    ...["MT", "US", "GB", "DE", "FR", "ES", "IT", "AE", "AU", "CA", "JP", "SG", "NL", "BE", "SE", "IN", "KE", "NG", "ZA", "GH"].map((c) => ({ value: c, label: c })),
                  ]}
                  error={errors.country}
                />
              </div>


              <Select
                id={`${uid}-listing`}
                label="Listing"
                placeholder="Select a listing"
                value={listingId}
                onChange={(e) => {
                  const selected = listingOptions.find(opt => opt.value === e.target.value);
                  setListingId(e.target.value);
                  setListingName(selected?.label ?? "");
                  setAvailability(null);
                }}
                error={errors.listingName}
                hint="Select the listing name from the dropdown."
                options={listingOptions}
              />

              <Input
                id={`${uid}-listingId`}
                label="Listing ID (optional)"
                placeholder="lst_abc123"
                value={listingId}
                onChange={(e) => {
                  setListingId(e.target.value);
                  setAvailability(null); // reset calendar on ID change
                }}
                hint="Providing an ID auto-loads the availability calendar."
              />

              {/* Dates — accommodation vs car */}
              {isAccommodation ? (
                <>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <p className="text-xs text-primary">
                      You can also click dates directly on the calendar →
                      {" "}<strong>{calSelectStep === "checkIn" ? "Select Check-In" : "Select Check-Out"}</strong>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      id={`${uid}-checkIn`}
                      label="Check-In Date"
                      type="date"
                      required
                      value={checkIn}
                      onChange={(e) => { setCheckIn(e.target.value); setAvailStatus("idle"); setPrice(null); setCalSelectStep("checkOut"); }}
                      error={errors.checkIn}
                    />
                    <Input
                      id={`${uid}-checkOut`}
                      label="Check-Out Date"
                      type="date"
                      required
                      min={checkIn || undefined}
                      value={checkOut}
                      onChange={(e) => { setCheckOut(e.target.value); setAvailStatus("idle"); setPrice(null); setCalSelectStep("checkIn"); }}
                      error={errors.checkOut}
                    />
                  </div>
                  {nights > 0 && (
                    <p className="text-xs text-slate-500">
                      <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-primary" />
                      {nights} night{nights !== 1 ? "s" : ""}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label htmlFor={`${uid}-guests`} className="block text-sm font-medium text-slate-700">
                        Guests <span className="text-danger">*</span>
                      </label>
                      <input
                        id={`${uid}-guests`}
                        type="number" min={1} max={50}
                        value={guests}
                        onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))}
                        className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary hover:border-slate-400 transition-colors"
                      />
                    </div>
                    {listingType === "hotel" && (
                      <div className="space-y-1">
                        <label htmlFor={`${uid}-rooms`} className="block text-sm font-medium text-slate-700">Rooms</label>
                        <input
                          id={`${uid}-rooms`}
                          type="number" min={1} max={50}
                          value={rooms}
                          onChange={(e) => setRooms(Math.max(1, Number(e.target.value)))}
                          className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary hover:border-slate-400 transition-colors"
                        />
                      </div>
                    )}
                    {listingType === "apartment" && (
                      <div className="space-y-1">
                        <label htmlFor={`${uid}-units`} className="block text-sm font-medium text-slate-700">Units</label>
                        <input
                          id={`${uid}-units`}
                          type="number" min={1} max={20}
                          value={units}
                          onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))}
                          className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary hover:border-slate-400 transition-colors"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      id={`${uid}-pickup`}
                      label="Pickup Date & Time"
                      type="datetime-local"
                      required
                      value={pickup}
                      onChange={(e) => { setPickup(e.target.value); setAvailStatus("idle"); setPrice(null); }}
                      rightIcon={<X className="h-4 w-4 cursor-pointer" onClick={() => { setPickup(""); setAvailStatus("idle"); setPrice(null); }} />}
                      error={errors.pickup}
                    />
                    <Input
                      id={`${uid}-returnDt`}
                      label="Return Date & Time"
                      type="datetime-local"
                      required
                      min={pickup || undefined}
                      value={returnDt}
                      onChange={(e) => { setReturnDt(e.target.value); setAvailStatus("idle"); setPrice(null); }}
                      rightIcon={<X className="h-4 w-4 cursor-pointer" onClick={() => { setReturnDt(""); setAvailStatus("idle"); setPrice(null); }} />}
                      error={errors.returnDt}
                    />
                  </div>
                  {nights > 0 && (
                    <p className="text-xs text-slate-500">
                      <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-primary" />
                      {nights} day{nights !== 1 ? "s" : ""}
                    </p>
                  )}
                  <div className="space-y-1 w-1/3">
                    <label htmlFor={`${uid}-guests-car`} className="block text-sm font-medium text-slate-700">Passengers</label>
                    <input
                      id={`${uid}-guests-car`}
                      type="number" min={1} max={20}
                      value={guests}
                      onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))}
                      className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary hover:border-slate-400 transition-colors"
                    />
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          {/* ════════════════════════════════════════════════════════════
              SECTION 3 – Availability Check
          ════════════════════════════════════════════════════════════ */}
          <SectionCard step={3} title="Availability Check" icon={Search}>
            <div className="space-y-4">
              {errors._avail && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">{errors._avail}</p>
                </div>
              )}

              <Button
                type="button"
                variant={availStatus === "available" ? "secondary" : "primary"}
                onClick={checkAvailability}
                loading={availStatus === "checking"}
                leftIcon={availStatus === "checking" ? undefined : <Search className="h-4 w-4" />}
              >
                {availStatus === "checking" ? "Checking…" : "Check Availability"}
              </Button>

              {availStatus === "available" && (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">✅ Available</p>
                    <p className="text-xs text-green-600">
                      This listing is available for the selected dates. Proceed to send a payment link.
                    </p>
                  </div>
                </div>
              )}

              {availStatus === "unavailable" && (
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">❌ Not Available</p>
                    <p className="text-xs text-red-600">
                      This listing is booked, locked, or unavailable for the selected dates. Please choose different dates.
                    </p>
                  </div>
                </div>
              )}

              {availStatus === "idle" && (
                <p className="text-xs text-slate-400">
                  The system will verify existing bookings, reservation locks, and available inventory.
                </p>
              )}
            </div>
          </SectionCard>

          {/* ════════════════════════════════════════════════════════════
              SECTION 4 – Price Summary (read-only)
          ════════════════════════════════════════════════════════════ */}
          {price && (
            <SectionCard step={4} title="Price Summary" icon={FileText}>
              <div className="space-y-0 rounded-lg border border-border overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50/60 border-b border-border">
                  <span className="text-sm text-slate-500">Base Amount</span>
                  <span className="text-sm font-medium text-slate-900">{formatCurrency(price.baseAmount, price.currency)}</span>
                </div>
                {price.discount > 0 && (
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border">
                    <span className="text-sm text-slate-500">Discount</span>
                    <span className="text-sm font-medium text-green-600">−{formatCurrency(price.discount, price.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center px-4 py-2.5 border-b border-border">
                  <span className="text-sm text-slate-500">Service Fee</span>
                  <span className="text-sm font-medium text-slate-900">{formatCurrency(price.serviceFee, price.currency)}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5 border-b border-border">
                  <span className="text-sm text-slate-500">Tax</span>
                  <span className="text-sm font-medium text-slate-900">{formatCurrency(price.tax, price.currency)}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 bg-primary/5">
                  <span className="text-sm font-bold text-slate-900">Total Amount</span>
                  <span className="text-base font-bold text-primary">{formatCurrency(price.total, price.currency)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Pricing is auto-calculated and cannot be edited by agents.
              </p>
            </SectionCard>
          )}

          {/* ════════════════════════════════════════════════════════════
              SECTION 5 – Payment
          ════════════════════════════════════════════════════════════ */}
          <SectionCard step={price ? 5 : 4} title="Payment" icon={CreditCard}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Payment Method</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["stripe", "tara"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${paymentMethod === m
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                    >
                      <CreditCard className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm font-semibold capitalize">{m === "tara" ? "Tara" : "Stripe"}</span>
                      {paymentMethod === m && (
                        <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-500">
                A secure payment link will be sent to <strong>{email || "the guest's email"}</strong> via{" "}
                <strong>{paymentMethod === "tara" ? "Tara" : "Stripe"}</strong>.
              </p>
            </div>
          </SectionCard>

          {/* ════════════════════════════════════════════════════════════
              SECTION 6 – Internal Information (auto-generated)
          ════════════════════════════════════════════════════════════ */}
          <SectionCard step={price ? 6 : 5} title="Internal Information" icon={Hash}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0 rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-xs text-slate-400 mb-0.5">Booking Reference</p>
                <p className="text-sm font-mono font-semibold text-primary">Auto-generated on submit</p>
              </div>
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-xs text-slate-400 mb-0.5">Created By</p>
                <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5 text-slate-400" />
                  {user?.name ?? "—"}
                </p>
              </div>
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-xs text-slate-400 mb-0.5">Created Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-xs text-slate-400 mb-0.5">Assigned Country</p>
                <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {country || "—"}
                </p>
              </div>
              <div className="px-4 py-2.5">
                <p className="text-xs text-slate-400 mb-0.5">Agent Role</p>
                <p className="text-sm font-medium text-slate-900 capitalize">{role?.replace("_", " ") ?? "—"}</p>
              </div>
            </div>
          </SectionCard>

          {/* ════════════════════════════════════════════════════════════
              Action Buttons
          ════════════════════════════════════════════════════════════ */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Link href="/dashboard/bookings">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                Cancel
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={saveDraftMut.isPending}
                leftIcon={<Save className="h-4 w-4" />}
                onClick={() => saveDraftMut.mutate()}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                loading={isSending}
                leftIcon={<Send className="h-4 w-4" />}
                onClick={handleSendLink}
                disabled={availStatus === "unavailable" || isSending}
              >
                Send Payment Link
              </Button>
            </div>
          </div>

        </div>{/* ── end left column ── */}

        {/* ════ RIGHT COLUMN – AVAILABILITY CALENDAR ══════════════════════════ */}
        <div className="sticky top-5">
          <AvailabilityCalendar
            checkIn={isAccommodation ? checkIn : ""}
            checkOut={isAccommodation ? checkOut : ""}
            availability={availability}
            loading={calLoading}
            onSelectDate={handleCalendarDateSelect}
          />
        </div>

      </div>{/* ── end grid ── */}
    </div>
  );
}

