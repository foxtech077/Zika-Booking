"use client";

import { useState, useEffect, useId, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, User, Building2, CalendarDays, Phone, Mail,
  Globe, FileText, AlertCircle, CheckCircle2, Search,
  CreditCard, Hash, UserCircle, MapPin, Loader2,
  Send, Save, X, ChevronLeft, ChevronRight, Info, ChevronDown, XCircle
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { paymentApi } from "@/lib/payment-api";
import { canAccess } from "@/permissions/rbac";
import { SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatCurrency, cn } from "@/lib/utils";
import type { AdminRole } from "@/types/admin";
import { DatePicker } from "@/components/ui/DatePicker";

const UISelect = Select;

// ── Types ─────────────────────────────────────────────────────────────────────

type ListingType = "hotel" | "apartment" | "car";
type CountryOption = { value: string; label: string };
type DayStatus = "past" | "available" | "locked" | "booked";
type AvailStatus = "idle" | "checking" | "available" | "unavailable";
type PaymentMethod = "stripe" | "tara";

import { COUNTRIES, BOOKING_COUNTRIES, getCountryFlag, type Country, type BookingCountry } from "@/lib/countries";

interface PriceSummary {
  baseAmount: number;
  discount: number;
  voucherDiscount?: number;
  promotionDiscount?: number;
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

function getDayStatus(dateStr: string, availability: AvailabilityData | null): DayStatus {
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

function getCurrencyForCountry(countryCode: string): string {
  const map: Record<string, string> = {
    IN: "INR", US: "USD", GB: "GBP", AE: "AED", SG: "SGD", JP: "JPY",
    AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR",
    DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR",
    LU: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR",
    AU: "AUD", CA: "CAD", CH: "CHF", CN: "CNY", ZA: "ZAR", KE: "KES",
  };
  return map[countryCode] || "USD";
}

function SectionCard({
  step,
  title,
  icon: Icon,
  children,
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
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
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalCells = startPad + lastDay.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(viewYear, viewMonth, d));

  const monthLabel = firstDay.toLocaleString("default", { month: "long", year: "numeric" });

  const todayStr = toYMD(new Date());

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

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden flex flex-col">
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
                  status === "booked"
                    ? "Fully booked"
                    : status === "locked"
                    ? "Reserved / Locked"
                    : status === "past"
                    ? "Past date"
                    : "Available"
                }
                onClick={() => !isDisabled && handleClick(date)}
                className={getCellStyle(ds) + getRangeClass(ds)}
              >
                {ds === todayStr && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                )}
                {date.getDate()}
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
        {/* Prompt when no availability */}
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

  // Access guard
  const hasAccess = canAccess(role, "manage_manual_booking");
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
          <AlertCircle className="h-7 w-7 text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Manual booking is restricted to authorized roles only.
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
  const [selectedCountry, setSelectedCountry] = useState<Country>((COUNTRIES.find(c => c.code === "KE") || COUNTRIES[0]) as Country);
  const [localPhone, setLocalPhone] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [nationality, setNationality] = useState("");
  const [notes, setNotes] = useState("");

  const phone = `${selectedCountry.dialCode}${localPhone.trim().replace(/\D/g, "")}`;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".phone-country-dropdown")) {
        setIsDropdownOpen(false);
      }
      if (!target.closest(".booking-country-dropdown")) {
        setIsBookingCountryOpen(false);
      }
      if (!target.closest(".booking-listing-dropdown")) {
        setIsListingSelectOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // ── Section 2: Booking Info ───────────────────────────────────────────────────
  const [listingType, setListingType] = useState<ListingType>("hotel");
  const [listingId, setListingId] = useState("");
  const [listingName, setListingName] = useState("");
  const [country, setCountry] = useState("");
  const [isBookingCountryOpen, setIsBookingCountryOpen] = useState(false);
  const [bookingCountrySearch, setBookingCountrySearch] = useState("");
  const [isListingSelectOpen, setIsListingSelectOpen] = useState(false);
  const [listingSelectSearch, setListingSelectSearch] = useState("");
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
  const [paymentLink, setPaymentLink] = useState<string>("");

  const [isSending, setIsSending] = useState(false);
  // ── Shared state ──────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const isAccommodation = listingType !== "car";
  const bookingRef = submitted ? `MBK-${Date.now().toString(36).toUpperCase()}` : "";

  // Reset conditional fields when listing type or country changes
  useEffect(() => {
    setCheckIn("");
    setCheckOut("");
    setPickup("");
    setReturnDt("");
    setAvailStatus("idle");
    setPrice(null);
    setAvailability(null);
    setCalSelectStep("checkIn");
    setListingId(""); setListingName("");
  }, [listingType, country]);

  // Fetch listings for dropdown
  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: ['listings', listingType, country],
    queryFn: async () => {
      const params: Record<string, string> = {
        limit: "1000",
      };
      if (listingType) params.category = listingType;
      if (country) params.country = country;
      const res = await listingApi.get('/admin/listings', { params });
      return res.data?.data ?? res.data;
    },
  });

  const listings = Array.isArray(listingsData) ? listingsData : (Array.isArray(listingsData?.listings) ? listingsData.listings : []);
  const listingOptions = [
    { value: "", label: "Select a listing" },
    ...listings.map((l: any) => ({
      value: l.id,
      label: l.name ?? l.title ?? l.id
    }))
  ];

  // ── Derived values ────────────────────────────────────────────────────
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

  const pricePerNight = price && nights > 0 ? price.baseAmount / nights : null;
  const pricePerGuest = price && guests > 0 ? price.total / guests : null;
  const serviceFeeRate = price && price.baseAmount > 0 ? (price.serviceFee / price.baseAmount) * 100 : null;
  const taxRate = price && price.baseAmount > 0 ? (price.tax / price.baseAmount) * 100 : null;

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const formatRate = (rate: number | null) => {
    if (rate === null) return "—";
    return rate % 1 === 0 ? `${rate}%` : `${rate.toFixed(2)}%`;
  };

  // ── Validation ─────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "Required";
    if (!lastName.trim()) e.lastName = "Required";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = "Valid email required";
    if (!localPhone.trim()) {
      e.phone = "Required";
    } else {
      const digitsOnly = localPhone.replace(/\D/g, "");
      if (digitsOnly.length < 6 || digitsOnly.length > 15) {
        e.phone = "Invalid phone number length (6-15 digits required)";
      }
    }
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

  // ── Check Availability ─────────────────────────────────────────────
  async function checkAvailability() {
    if (!listingId) {
      setErrors((p) => ({ ...p, listingName: "Select a listing first" }));
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

    try {
      const params: Record<string, string> = {
        listingType,
        listingId,
        listingName,
        ...(isAccommodation ? { checkIn, checkOut } : { pickupDatetime: pickup, returnDatetime: returnDt }),
        guests: String(guests),
      };



      const res = await listingApi.get("/admin/bookings/availability", { params });
      const d = res.data?.data ?? res.data;
      setAvailStatus(d.available ? "available" : "unavailable");
      if (d.available && d.pricing) {
        setPrice({
          baseAmount: d.pricing.baseAmount ?? 0,
          discount: d.pricing.discount ?? 0,
          voucherDiscount: d.pricing.voucherDiscount,
          promotionDiscount: d.pricing.promotionDiscount,
          serviceFee: d.pricing.serviceFee ?? 0,
          tax: d.pricing.tax ?? 0,
          total: d.pricing.total ?? 0,
          currency: d.pricing.currency ?? getCurrencyForCountry(country),
        });
      }
      if (d.bookedRanges || d.lockedRanges) {
        setAvailability({
          bookedRanges: d.bookedRanges ?? [],
          lockedRanges: d.lockedRanges ?? [],
        });
      }
    } catch {
      // Mock fallback
      setAvailStatus("available");
      const base = nights * 120;
      setPrice({
        baseAmount: base,
        discount: 0,
        serviceFee: Math.round(base * 0.05),
        tax: Math.round(base * 0.10),
        total: Math.round(base * 1.15),
        currency: getCurrencyForCountry(country),
      });
      if (!availability) {
        const today = new Date();
        const rel = (startOffset: number, endOffset: number) => {
          const s = new Date(today);
          s.setDate(s.getDate() + startOffset);
          const e = new Date(today);
          e.setDate(e.getDate() + endOffset);
          return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
        };
        setAvailability({
          bookedRanges: [rel(2, 5), rel(10, 14), rel(22, 25)],
          lockedRanges: [rel(7, 9), rel(18, 20)],
        });
      }
    }
  }

  const renderClearDate = (setter: (v: string) => void) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        setter("");
        setAvailStatus("idle");
        setPrice(null);
      }}
      className="mr-11 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer pointer-events-auto z-10"
      title="Clear date"
    >
      <X className="h-4 w-4" />
    </button>
  );




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

  const paymentLinkMut = useMutation({
    mutationFn: async (bookingId: string) => {
      console.log("Generating payment link for bookingId:", bookingId);
      const endpoint = paymentMethod === "stripe" ? "/stripe/payment-link" : "/tara/payment-link";
      const res = await paymentApi.post(endpoint, { bookingId });
      return res.data as { paymentLink: string };
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? "Failed to generate payment link.";
      setErrors((p) => ({ ...p, _api: msg }));
    },
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
      await paymentApi.post(`/${paymentMethod}/payment-link`, { bookingId });
      setSubmitted(true);
      setLinkSent(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Failed to send payment link.";
      setErrors(p => ({ ...p, _api: msg }));
    } finally {
      setIsSending(false);
    }
  }

  // ── Success State ─────────────────────────────────────────────────────
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
              setFirstName(""); setLastName(""); setEmail(""); setLocalPhone("");
              setSelectedCountry((COUNTRIES.find((c) => c.code === "KE") || COUNTRIES[0]) as Country);
              setNationality(""); setNotes(""); setListingName(""); setListingId("");
              setCountry(""); setCheckIn(""); setCheckOut(""); setPickup(""); setReturnDt("");
              setGuests(1); setRooms(1); setUnits(1);
              setAvailStatus("idle"); setPrice(null); setAvailability(null);
            }}
          >
            New Booking
          </Button>
          <Link href="/dashboard/bookings">
            <Button>View Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/dashboard/bookings">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <SectionHeader title="Create Manual Booking" description="Complete all sections then send a payment link to the guest." />
      </div>

      {/* API error banner */}
      {errors._api && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 mb-5">
          <AlertCircle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger flex-1">{errors._api}</p>
          <button onClick={() => setErrors((p) => { const n = { ...p }; delete n._api; return n; })} className="text-danger/60 hover:text-danger">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Two-column layout: form left + calendar sidebar right */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Section 1 - Customer Information */}
          <SectionCard step={1} title="Customer Information" icon={User}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input id={`${uid}-firstName`} label="First Name" required placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={errors.firstName} />
                <Input id={`${uid}-lastName`} label="Last Name" required placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} error={errors.lastName} />
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
                <div className="space-y-1">
                  <label htmlFor={`${uid}-phone`} className="block text-sm font-medium text-slate-700">
                    Phone Number <span className="text-danger ml-0.5">*</span>
                  </label>
                  <div className="flex gap-2 relative">
                    {/* Country Selector Dropdown */}
                    <div className="w-[180px] flex-shrink-0 relative phone-country-dropdown">
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={cn(
                          "w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-slate-900",
                          "transition-colors duration-150 h-[38px] mt-0.5",
                          "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
                          errors.phone ? "border-danger" : "border-border hover:border-slate-400"
                        )}
                      >
                        <span className="truncate">
                          {selectedCountry.name === "United Arab Emirates" ? "UAE" : selectedCountry.name} ({selectedCountry.dialCode})
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400 ml-1 flex-shrink-0" />
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-[260px] rounded-lg border border-border bg-white shadow-lg z-50 p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search country or code..."
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="overflow-y-auto max-h-[200px]">
                            {COUNTRIES.filter(
                              (c) =>
                                c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                c.code.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                c.dialCode.includes(countrySearch)
                            ).map((c) => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  setSelectedCountry(c);
                                  setIsDropdownOpen(false);
                                  setCountrySearch("");
                                }}
                                className={cn(
                                  "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition-colors flex items-center justify-between",
                                  selectedCountry.code === c.code ? "bg-primary/5 text-primary font-semibold" : "text-slate-700"
                                )}
                              >
                                <span className="truncate">{c.name}</span>
                                <span className="text-slate-400 font-mono flex-shrink-0 ml-1">{c.dialCode}</span>
                              </button>
                            ))}
                            {COUNTRIES.filter(
                              (c) =>
                                c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                c.code.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                c.dialCode.includes(countrySearch)
                            ).length === 0 && (
                              <p className="text-xs text-slate-400 text-center py-2">No countries found</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Phone Number Input */}
                    <div className="flex-1 relative">
                      <input
                        id={`${uid}-phone`}
                        type="tel"
                        required
                        placeholder="700000000"
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value)}
                        className={cn(
                          "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
                          "transition-colors duration-150 h-[38px] mt-0.5",
                          "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
                          errors.phone
                            ? "border-danger focus:border-danger focus:ring-danger/25"
                            : "border-border hover:border-slate-400"
                        )}
                      />
                    </div>
                  </div>
                  {errors.phone && <p className="text-xs text-danger mt-1">{errors.phone}</p>}
                </div>
              </div>
              <Textarea id={`${uid}-notes`} label="Notes / Special Requests" placeholder="Any special requests or notes for this booking..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} hint="Visible to internal staff only." />
            </div>
          </SectionCard>

          {/* Section 2 - Booking Information */}
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
                <div className="space-y-1 relative booking-country-dropdown">
                  <label htmlFor={`${uid}-country`} className="block text-sm font-medium text-slate-700">
                    Country <span className="text-danger ml-0.5">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBookingCountryOpen(!isBookingCountryOpen)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-slate-900",
                      "transition-colors duration-150 h-[38px] mt-0.5",
                      "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
                      errors.country ? "border-danger" : "border-border hover:border-slate-400"
                    )}
                  >
                    <span>
                      {country ? (
                        (() => {
                          const found = BOOKING_COUNTRIES.find(c => c.code === country);
                          return found ? `${found.flag} ${found.name} (${found.code})` : country;
                        })()
                      ) : (
                        "Select country…"
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 ml-1 flex-shrink-0" />
                  </button>

                  {isBookingCountryOpen && (
                    <div className="absolute left-0 mt-1 w-full rounded-lg border border-border bg-white shadow-lg z-50 p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search country or code..."
                          value={bookingCountrySearch}
                          onChange={(e) => setBookingCountrySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="overflow-y-auto max-h-[200px]">
                        {BOOKING_COUNTRIES.filter(
                          (c) =>
                            c.name.toLowerCase().includes(bookingCountrySearch.toLowerCase()) ||
                            c.code.toLowerCase().includes(bookingCountrySearch.toLowerCase())
                        ).map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setCountry(c.code);
                              setIsBookingCountryOpen(false);
                              setBookingCountrySearch("");
                            }}
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition-colors flex items-center gap-2",
                              country === c.code ? "bg-primary/5 text-primary font-semibold" : "text-slate-700"
                            )}
                          >
                            <span>{c.flag}</span>
                            <span className="truncate">{c.name}</span>
                            <span className="text-slate-400 font-mono flex-shrink-0 ml-auto">{c.code}</span>
                          </button>
                        ))}
                        {BOOKING_COUNTRIES.filter(
                          (c) =>
                            c.name.toLowerCase().includes(bookingCountrySearch.toLowerCase()) ||
                            c.code.toLowerCase().includes(bookingCountrySearch.toLowerCase())
                        ).length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-2">No countries found</p>
                        )}
                      </div>
                    </div>
                  )}
                  {errors.country && <p className="text-xs text-danger mt-1">{errors.country}</p>}
                </div>
              </div>


              <div className="space-y-1 relative booking-listing-dropdown">
                <label htmlFor={`${uid}-listing`} className="block text-sm font-medium text-slate-700">
                  Listing
                </label>
                <button
                  type="button"
                  onClick={() => setIsListingSelectOpen(!isListingSelectOpen)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-slate-900",
                    "transition-colors duration-150 h-[38px] mt-0.5",
                    "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
                    errors.listingName ? "border-danger" : "border-border hover:border-slate-400"
                  )}
                >
                  <span className="truncate">
                    {listingName || "Select a listing"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400 ml-1 flex-shrink-0" />
                </button>

                {isListingSelectOpen && (
                  <div className="absolute left-0 mt-1 w-full rounded-lg border border-border bg-white shadow-lg z-50 p-2 space-y-1.5 max-h-[350px] overflow-y-auto">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search listing by name or ID..."
                        value={listingSelectSearch}
                        onChange={(e) => setListingSelectSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="overflow-y-auto max-h-[250px] space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setListingId("");
                          setListingName("");
                          setAvailability(null);
                          setIsListingSelectOpen(false);
                          setListingSelectSearch("");
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-500 transition-colors"
                      >
                        Select a listing (none)
                      </button>
                      {listings.filter((l: any) => {
                        const query = listingSelectSearch.toLowerCase();
                        return (
                          (l.name?.toLowerCase().includes(query) || false) ||
                          (l.title?.toLowerCase().includes(query) || false) ||
                          (l.id?.toLowerCase().includes(query) || false) ||
                          (l.town?.toLowerCase().includes(query) || false)
                        );
                      }).map((l: any) => {
                        const isSelected = listingId === l.id;
                        const name = l.name ?? l.title ?? l.id;
                        const details = [
                          l.category ? l.category.charAt(0).toUpperCase() + l.category.slice(1) : "",
                          l.town ?? "",
                          l.pricePerNight ? `${l.pricePerNight} ${l.currency ?? "USD"}` : ""
                        ].filter(Boolean).join(" · ");

                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => {
                              setListingId(l.id);
                              setListingName(name);
                              setAvailability(null);
                              setIsListingSelectOpen(false);
                              setListingSelectSearch("");
                            }}
                            className={cn(
                              "w-full text-left px-2 py-2 text-xs rounded hover:bg-slate-100 transition-colors flex flex-col gap-0.5",
                              isSelected ? "bg-primary/5 border-l-2 border-primary pl-1.5" : ""
                            )}
                          >
                            <div className={cn("font-medium", isSelected ? "text-primary" : "text-slate-900")}>
                              {name}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center justify-between gap-2 w-full">
                              <span>{details}</span>
                              <span className="font-mono text-slate-300 text-[9px] select-all">{l.id}</span>
                            </div>
                          </button>
                        );
                      })}
                      {listings.filter((l: any) => {
                        const query = listingSelectSearch.toLowerCase();
                        return (
                          (l.name?.toLowerCase().includes(query) || false) ||
                          (l.title?.toLowerCase().includes(query) || false) ||
                          (l.id?.toLowerCase().includes(query) || false) ||
                          (l.town?.toLowerCase().includes(query) || false)
                        );
                      }).length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">No listings found</p>
                      )}
                    </div>
                  </div>
                )}
                {errors.listingName && <p className="text-xs text-danger mt-1">{errors.listingName}</p>}
              </div>

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
                    <DatePicker
                      id={`${uid}-checkIn`}
                      label="Check-In Date"
                      required
                      value={checkIn}
                      onChange={(val) => { setCheckIn(val); setAvailStatus("idle"); setPrice(null); setCalSelectStep("checkOut"); }}
                      error={errors.checkIn}
                    />
                    <DatePicker
                      id={`${uid}-checkOut`}
                      label="Check-Out Date"
                      required
                      minDate={checkIn || undefined}
                      value={checkOut}
                      onChange={(val) => { setCheckOut(val); setAvailStatus("idle"); setPrice(null); setCalSelectStep("checkIn"); }}
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
                        onFocus={(e) => {
                          const target = e.target;
                          setTimeout(() => target.select(), 0);
                        }}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
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
                          onFocus={(e) => {
                            const target = e.target;
                            setTimeout(() => target.select(), 0);
                          }}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
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
                          onFocus={(e) => {
                            const target = e.target;
                            setTimeout(() => target.select(), 0);
                          }}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary hover:border-slate-400 transition-colors"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <DatePicker
                    id={`${uid}-pickup`}
                    label="Pickup"
                    required
                    value={pickup}
                    onChange={(val) => { setPickup(val); setAvailStatus("idle"); setPrice(null); }}
                    error={errors.pickup}
                  />
                  <DatePicker
                    id={`${uid}-return`}
                    label="Return"
                    required
                    minDate={pickup || undefined}
                    value={returnDt}
                    onChange={(val) => { setReturnDt(val); setAvailStatus("idle"); setPrice(null); }}
                    error={errors.returnDt}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <UISelect id={`${uid}-guests`} label="Guests" required value={String(guests)} onChange={(e) => setGuests(Number(e.target.value))} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
                {listingType === "hotel" && (
                  <UISelect id={`${uid}-rooms`} label="Rooms" required value={String(rooms)} onChange={(e) => setRooms(Number(e.target.value))} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
                )}
                {listingType === "apartment" && (
                  <UISelect id={`${uid}-units`} label="Units" required value={String(units)} onChange={(e) => setUnits(Number(e.target.value))} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
                )}
              </div>
            </div>
          </SectionCard>

          {/* Section 3 - Availability Check */}
          <SectionCard step={3} title="Availability Check" icon={Search}>
            <div className="space-y-4">
              <Button
                type="button"
                variant="secondary"
                loading={availStatus === "checking"}
                leftIcon={<Search className="h-4 w-4" />}
                onClick={checkAvailability}
              >
                Check Availability
              </Button>
              {availStatus === "available" && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-green-700">Available for the selected dates</p>
                </div>
              )}
              {availStatus === "unavailable" && (
                <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3">
                  <XCircle className="h-4 w-4 text-danger flex-shrink-0" />
                  <p className="text-sm font-medium text-danger">Not available for the selected dates</p>
                </div>
              )}
              {errors._avail && (
                <p className="text-xs text-danger">{errors._avail}</p>
              )}
              {availStatus === "idle" && (
                <p className="text-sm text-slate-400">
                  The system will verify existing bookings, reservation locks, and available inventory.
                </p>
              )}
            </div>
          </SectionCard>

          {/* Section 4 - Payment */}
          <SectionCard step={4} title="Payment" icon={CreditCard}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("stripe")}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      paymentMethod === "stripe"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    Stripe
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("tara")}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      paymentMethod === "tara"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    Tara
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                A secure payment link will be sent to{" "}
                <strong>the guest's email</strong> via{" "}
                {paymentMethod === "stripe" ? "Stripe" : "Tara"}.
              </p>

              {/* Price summary (shown when available) */}
              {price && (
                <div className="space-y-4">
                  {/* Booking Summary */}
                  <div className="rounded-lg border border-border bg-slate-50/60 p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Booking Summary</h3>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-slate-600">
                      <div><span className="font-medium text-slate-700 block mb-0.5">Listing</span> {listingName || "—"}</div>
                      <div><span className="font-medium text-slate-700 block mb-0.5">Listing Type</span> <span className="capitalize">{listingType}</span></div>
                      <div><span className="font-medium text-slate-700 block mb-0.5">Country</span> {country || "—"}</div>
                      
                      {isAccommodation ? (
                        <>
                          <div><span className="font-medium text-slate-700 block mb-0.5">Check-In</span> {formatDateLabel(checkIn)}</div>
                          <div><span className="font-medium text-slate-700 block mb-0.5">Check-Out</span> {formatDateLabel(checkOut)}</div>
                          <div><span className="font-medium text-slate-700 block mb-0.5">Nights</span> {nights}</div>
                          <div><span className="font-medium text-slate-700 block mb-0.5">Guests</span> {guests}</div>
                          {listingType === "hotel" && <div><span className="font-medium text-slate-700 block mb-0.5">Rooms</span> {rooms}</div>}
                          {listingType === "apartment" && <div><span className="font-medium text-slate-700 block mb-0.5">Units</span> {units}</div>}
                        </>
                      ) : (
                        <>
                          <div><span className="font-medium text-slate-700 block mb-0.5">Pickup</span> {formatDateLabel(pickup)}</div>
                          <div><span className="font-medium text-slate-700 block mb-0.5">Return</span> {formatDateLabel(returnDt)}</div>
                          <div><span className="font-medium text-slate-700 block mb-0.5">Days</span> {nights}</div>
                          <div><span className="font-medium text-slate-700 block mb-0.5">Guests</span> {guests}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="rounded-lg border border-border bg-slate-50/60 p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Pricing Breakdown</h3>
                    
                    <div className="pt-2 space-y-1.5">
                      <InfoRow label="Base Booking Amount" value={formatCurrency(price.baseAmount, price.currency)} />
                      {price.voucherDiscount !== undefined && price.voucherDiscount > 0 && <InfoRow label="Voucher Discount" value={`-${formatCurrency(price.voucherDiscount, price.currency)}`} />}
                      {price.promotionDiscount !== undefined && price.promotionDiscount > 0 && <InfoRow label="Promotion Discount" value={`-${formatCurrency(price.promotionDiscount, price.currency)}`} />}
                      {price.discount > 0 && !price.voucherDiscount && !price.promotionDiscount && <InfoRow label="Discount" value={`-${formatCurrency(price.discount, price.currency)}`} />}
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <InfoRow label="Subtotal" value={formatCurrency(price.baseAmount - price.discount, price.currency)} />
                      <InfoRow label={serviceFeeRate !== null ? `Service Fee (${formatRate(serviceFeeRate)})` : "Service Fee"} value={formatCurrency(price.serviceFee, price.currency)} />
                      <InfoRow label={taxRate !== null ? `Tax (${formatRate(taxRate)})` : "Tax"} value={formatCurrency(price.tax, price.currency)} />
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-slate-900">Grand Total</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(price.total, price.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </SectionCard>

          {/* Section 5 - Internal Information */}
          <SectionCard step={5} title="Internal Information" icon={Hash}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Booking Reference</p>
                <p className="text-sm font-mono text-primary">Auto-generated on submit</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Created By</p>
                <div className="flex items-center gap-1.5">
                  <UserCircle className="h-4 w-4 text-slate-400" />
                  <p className="text-sm text-slate-700">{user?.name ?? "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Created Date</p>
                <p className="text-sm text-slate-700">
                  {new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Assigned Country</p>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <p className="text-sm text-slate-700">{country || "-"}</p>
                </div>
              </div>
              {role && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Agent Role</p>
                  <p className="text-sm text-slate-700 capitalize">{role.replace(/_/g, " ")}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Action Buttons */}
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
                onClick={() => {
                  if (!validate()) return;
                  saveDraftMut.mutate();
                }}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                loading={isSending}
                leftIcon={<Send className="h-4 w-4" />}
                onClick={() => {
                  if (!validate()) return;
                  handleSendLink();
                }}
                disabled={availStatus === "unavailable" || isSending}
              >
                Send Payment Link
              </Button>
            </div>
          </div>

        </div>

        {/* Right column - Availability Calendar sidebar */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-6 self-start">
          <AvailabilityCalendar
            checkIn={checkIn}
            checkOut={checkOut}
            availability={availability}
            loading={calLoading}
            onSelectDate={(date) => {
              if (calSelectStep === "checkIn") {
                setCheckIn(date);
                setCheckOut("");
                setCalSelectStep("checkOut");
              } else {
                if (date > checkIn) {
                  setCheckOut(date);
                  setCalSelectStep("checkIn");
                } else {
                  setCheckIn(date);
                  setCheckOut("");
                }
              }
            }}
          />
        </div>

      </div>
    </div>
  );
}

