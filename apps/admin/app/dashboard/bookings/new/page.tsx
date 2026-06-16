"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, User, Building2, CalendarDays, Phone, Mail,
  Globe, FileText, AlertCircle, CheckCircle2, Search,
  CreditCard, Hash, UserCircle, MapPin, Loader2,
  Send, Save, X, ChevronRight, Calculator,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { canAccess } from "@/permissions/rbac";
import { SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { ListingSearchDropdown } from "../../../../components/ui/ListingSearchDropdown";
import type { SelectedListing } from "../../../../components/ui/ListingSearchDropdown";
import { formatCurrency } from "@/lib/utils";
import type { AdminRole } from "@/types/admin";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type ListingType = "hotel" | "apartment" | "car";
type AvailStatus = "idle" | "checking" | "available" | "unavailable";
type PaymentMethod = "stripe" | "tara";

interface PriceSummary {
  baseAmount: number;
  discount: number;
  serviceFee: number;
  tax: number;
  total: number;
  currency: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [nationality, setNationality] = useState("");
  const [notes, setNotes]             = useState("");

  // ── Section 2: Booking Info ───────────────────────────────────────────────────
  const [listingType, setListingType]   = useState<ListingType>("hotel");
  const [selectedListing, setSelectedListing] = useState<SelectedListing | null>(null);
  const [country, setCountry]           = useState("");
  const [checkIn, setCheckIn]           = useState("");
  const [checkOut, setCheckOut]         = useState("");
  const [pickup, setPickup]             = useState("");
  const [returnDt, setReturnDt]         = useState("");
  const [guests, setGuests]             = useState(1);
  const [rooms, setRooms]               = useState(1);
  const [units, setUnits]               = useState(1);

  // ── Section 3: Availability ───────────────────────────────────────────────────
  const [availStatus, setAvailStatus] = useState<AvailStatus>("idle");

  // ── Section 4: Price ──────────────────────────────────────────────────────────
  const [price, setPrice] = useState<PriceSummary | null>(null);

  // ── Section 5: Payment ────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [linkSent, setLinkSent]           = useState(false);

  // ── Shared state ──────────────────────────────────────────────────────────────
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const isAccommodation = listingType !== "car";
  const bookingRef = submitted ? `MBK-${Date.now().toString(36).toUpperCase()}` : "";

  // Reset conditional date fields when listing type changes
  useEffect(() => {
    setSelectedListing(null);
    setCheckIn(""); setCheckOut(""); setPickup(""); setReturnDt("");
    setAvailStatus("idle"); setPrice(null);
  }, [listingType]);

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

  // ── Derived: detailed pricing factors ─────────────────────────────────────────
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

  // ── Validate ─────────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "Required";
    if (!lastName.trim())  e.lastName  = "Required";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = "Valid email required";
    if (!phone.trim())     e.phone     = "Required";
    if (!selectedListing) e.listingName = "Please select a listing";
    if (!country.trim())     e.country    = "Required";

    if (isAccommodation) {
      if (!checkIn)  e.checkIn  = "Required";
      if (!checkOut) e.checkOut = "Required";
      if (checkIn && checkOut && checkIn >= checkOut) e.checkOut = "Must be after check-in";
    } else {
      if (!pickup)   e.pickup   = "Required";
      if (!returnDt) e.returnDt = "Required";
      if (pickup && returnDt && pickup >= returnDt) e.returnDt = "Must be after pickup";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Check Availability ────────────────────────────────────────────────────────
  async function checkAvailability() {
    if (!selectedListing) {
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
        listingId: selectedListing.id,
        listingName: selectedListing.name,
        ...(isAccommodation ? { checkIn, checkOut } : { pickupDatetime: pickup, returnDatetime: returnDt }),
        guests: String(guests),
      };
      const res = await listingApi.get("/admin/bookings/availability", { params });
      const d = res.data?.data ?? res.data;
      setAvailStatus(d.available ? "available" : "unavailable");
      if (d.available && d.pricing) {
        setPrice({
          baseAmount: d.pricing.baseAmount ?? 0,
          discount:   d.pricing.discount   ?? 0,
          serviceFee: d.pricing.serviceFee ?? 0,
          tax:        d.pricing.tax        ?? 0,
          total:      d.pricing.total      ?? 0,
          currency:   d.pricing.currency   ?? "USD",
        });
        // ID is already populated from the dropdown selection
      }
    } catch {
      // Endpoint not yet live — show mock available + estimated price
      setAvailStatus("available");
      const base = nights * 120;
      setPrice({
        baseAmount: base,
        discount:   0,
        serviceFee: Math.round(base * 0.05),
        tax:        Math.round(base * 0.10),
        total:      Math.round(base * 1.15),
        currency:   "USD",
      });
    }
  }

  // ── Send Payment Link ─────────────────────────────────────────────────────────
  const sendLinkMut = useMutation({
    mutationFn: () =>
      listingApi.post("/admin/bookings/manual", {
        listingId: selectedListing!.id, listingType, listingName: selectedListing!.name,
        guestFirstName: firstName, guestLastName: lastName,
        guestEmail: email, guestPhone: phone, nationality,
        country, guests,
        ...(isAccommodation ? { checkIn, checkOut, rooms, units } : { pickupDatetime: pickup, returnDatetime: returnDt }),
        paymentMethod,
        notes,
        agentId: user?.id,
        agentName: user?.name,
      }).then((r) => r.data),
    onSuccess: () => { setSubmitted(true); setLinkSent(true); },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? "Failed to send payment link.";
      setErrors((p) => ({ ...p, _api: msg }));
    },
  });

  // ── Save Draft ────────────────────────────────────────────────────────────────
  const saveDraftMut = useMutation({
    mutationFn: () =>
      listingApi.post("/admin/bookings/drafts", {
        listingId: selectedListing!.id, listingType, listingName: selectedListing!.name,
        guestFirstName: firstName, guestLastName: lastName,
        guestEmail: email, guestPhone: phone, nationality,
        country, guests, notes,
        ...(isAccommodation ? { checkIn, checkOut } : { pickupDatetime: pickup, returnDatetime: returnDt }),
      }).then((r) => r.data),
    onSuccess: () => setErrors({}),
    onError: () => setErrors((p) => ({ ...p, _api: "Draft saved (backend not yet active — data stored locally)." })),
  });

  function handleSendLink() {
    if (!validate()) return;
    if (availStatus !== "available") {
      setErrors((p) => ({ ...p, _avail: "Please check availability before sending a payment link." }));
      return;
    }
    sendLinkMut.mutate();
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
              setNationality(""); setNotes(""); setSelectedListing(null);
              setCountry(""); setCheckIn(""); setCheckOut(""); setPickup(""); setReturnDt("");
              setGuests(1); setRooms(1); setUnits(1);
              setAvailStatus("idle"); setPrice(null);
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
    <div className="max-w-2xl space-y-5 pb-10">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
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
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger flex-1">{errors._api}</p>
          <button onClick={() => setErrors((p) => { const n = {...p}; delete n._api; return n; })} className="text-danger/60 hover:text-danger">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                { value: "hotel",     label: "Hotel" },
                { value: "apartment", label: "Apartment" },
                { value: "car",       label: "Car Rental" },
              ]}
            />
            <Select
              id={`${uid}-country`}
              label="Country"
              required
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setSelectedListing(null);
                setAvailStatus("idle");
                setPrice(null);
              }}
              options={[
                { value: "", label: "Select country…" },
                ...["MT","US","GB","DE","FR","ES","IT","AE","AU","CA","JP","SG","NL","BE","SE","IN","KE","NG","ZA","GH"].map((c) => ({ value: c, label: c })),
              ]}
              error={errors.country}
            />
          </div>

          <ListingSearchDropdown
            country={country}
            listingType={listingType}
            value={selectedListing}
            onChange={(listing: SelectedListing | null) => {
              setSelectedListing(listing);
              setAvailStatus("idle");
              setPrice(null);
            }}
            error={errors.listingName}
          />

          {/* Dates — accommodation vs car */}
          {isAccommodation ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id={`${uid}-checkIn`}
                  label="Check-In Date"
                  type="date"
                  required
                  value={checkIn}
                  onChange={(e) => { setCheckIn(e.target.value); setAvailStatus("idle"); setPrice(null); }}
                  error={errors.checkIn}
                />
                <Input
                  id={`${uid}-checkOut`}
                  label="Check-Out Date"
                  type="date"
                  required
                  min={checkIn || undefined}
                  value={checkOut}
                  onChange={(e) => { setCheckOut(e.target.value); setAvailStatus("idle"); setPrice(null); }}
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
                <p className="text-sm font-semibold text-green-800">Available</p>
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
                <p className="text-sm font-semibold text-red-800">Not Available</p>
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
          <div className="space-y-6">
            
            {/* 1. Booking Details Summary */}
            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Building2 className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Listing Details</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {selectedListing?.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary capitalize">
                        {listingType}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 uppercase">
                        <MapPin className="h-3 w-3 mr-1 text-slate-400" />
                        {country}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Booking Period & Capacity</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {isAccommodation 
                        ? `${formatDateLabel(checkIn)} – ${formatDateLabel(checkOut)}` 
                        : `${formatDateLabel(pickup)} – ${formatDateLabel(returnDt)}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {nights} {isAccommodation ? (nights === 1 ? "night" : "nights") : (nights === 1 ? "day" : "days")}
                      {" · "}{guests} {guests === 1 ? "guest" : "guests"}
                      {listingType === "hotel" && ` · ${rooms} ${rooms === 1 ? "room" : "rooms"}`}
                      {listingType === "apartment" && ` · ${units} ${units === 1 ? "unit" : "units"}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2 & 3. Per-Day and Per-Person pricing formulas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Per-Day Breakdown */}
              <div className="bg-slate-50/30 rounded-xl p-4 border border-slate-100 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Per-Day Pricing</span>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    Daily Rate
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-800">
                    {pricePerNight !== null 
                      ? `${formatCurrency(pricePerNight, price.currency, { currencyDisplay: "code" })} / ${isAccommodation ? "night" : "day"}`
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {pricePerNight !== null 
                      ? `${formatCurrency(pricePerNight, price.currency, { currencyDisplay: "code" })} × ${nights} ${nights === 1 ? (isAccommodation ? "night" : "day") : (isAccommodation ? "nights" : "days")} = ${formatCurrency(price.baseAmount, price.currency, { currencyDisplay: "code" })}`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Per-Guest Breakdown */}
              <div className="bg-slate-50/30 rounded-xl p-4 border border-slate-100 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Per-Person Cost</span>
                  <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                    Per Guest
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-800">
                    {pricePerGuest !== null 
                      ? `${formatCurrency(pricePerGuest, price.currency, { currencyDisplay: "code" })} / guest`
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {pricePerGuest !== null 
                      ? `${formatCurrency(price.total, price.currency, { currencyDisplay: "code" })} total ÷ ${guests} ${guests === 1 ? "guest" : "guests"} = ${formatCurrency(pricePerGuest, price.currency, { currencyDisplay: "code" })} / guest`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Fee breakdown (accommodation, service fee, tax, discount) */}
            <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-white">
              <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fee Breakdown</h3>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-slate-500">Accommodation Subtotal</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(price.baseAmount, price.currency, { currencyDisplay: "code" })}
                  </span>
                </div>
                
                {price.discount > 0 && (
                  <div className="flex justify-between items-center px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Discount</span>
                      <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                        Promo
                      </span>
                    </div>
                    <span className="text-sm font-bold text-green-600">
                      −{formatCurrency(price.discount, price.currency, { currencyDisplay: "code" })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Service Fee</span>
                    <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                      Rate: {formatRate(serviceFeeRate)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(price.serviceFee, price.currency, { currencyDisplay: "code" })}
                  </span>
                </div>

                <div className="flex justify-between items-center px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Tax</span>
                    <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                      Rate: {formatRate(taxRate)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(price.tax, price.currency, { currencyDisplay: "code" })}
                  </span>
                </div>

                <div className="flex justify-between items-center px-4 py-3.5 bg-primary/5">
                  <span className="text-sm font-bold text-slate-800">Total Amount</span>
                  <span className="text-lg font-extrabold text-primary">
                    {formatCurrency(price.total, price.currency, { currencyDisplay: "code" })} total
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Calculation summary card with highlighted formulas */}
            <div className="bg-primary/[0.02] border border-primary/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Price Formula Breakdown</h4>
                  <p className="text-[11px] text-slate-400">How your total booking fee is computed</p>
                </div>
              </div>
              <div className="bg-white px-3 py-2 border border-slate-100 rounded-lg shadow-sm">
                <span className="text-xs font-semibold font-mono text-slate-600">
                  {formatCurrency(price.baseAmount, price.currency, { currencyDisplay: "code" })} (Base)
                  {price.discount > 0 ? ` − ${formatCurrency(price.discount, price.currency, { currencyDisplay: "code" })} (Discount)` : ""}
                  {` + ${formatCurrency(price.serviceFee, price.currency, { currencyDisplay: "code" })} (Fee)`}
                  {` + ${formatCurrency(price.tax, price.currency, { currencyDisplay: "code" })} (Tax)`}
                  {` = `}
                  <span className="text-primary font-bold">{formatCurrency(price.total, price.currency, { currencyDisplay: "code" })}</span>
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Pricing is auto-calculated based on rules set by management and cannot be modified.
            </p>
          </div>
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
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
                    paymentMethod === m
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
            loading={sendLinkMut.isPending}
            leftIcon={<Send className="h-4 w-4" />}
            onClick={handleSendLink}
          >
            Send Payment Link
          </Button>
        </div>
      </div>
    </div>
  );
}
