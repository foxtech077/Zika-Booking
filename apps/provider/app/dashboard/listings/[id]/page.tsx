"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Edit3,
  Hotel,
  Home,
  Car,
  TrendingUp,
  BookOpen,
  Star,
  MapPin,
  DollarSign,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Clock,
  Images,
  Award,
  ShieldAlert,
  ChevronRight,
  Wifi,
  ParkingSquare,
  Dumbbell,
  Wind,
  Coffee,
  UtensilsCrossed,
  Laptop,
  Waves,
  Users,
  BedDouble,
  Bath,
  Fuel,
  Settings2,
  FileText,
  Globe,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { listingsService } from "@/services/listings";
import { LISTING_QK } from "@/hooks/listings";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/modals/Modals";
import {
  formatDate,
  formatCurrency,
  formatRelativeTime,
  slugToLabel,
  cn,
} from "@/lib/utils";
import type { Listing, ListingCategory } from "@/types/provider";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FullListing extends Listing {
  photos: { id: string; cdnUrl: string; position: number }[];
  documents: { id: string; documentType: string; fileType?: string }[];
  amenities: { amenityKey: string }[];
  customAmenities: { label: string }[];
}

interface ListingSummaryItem {
  id: string;
  bookingCount: number;
  totalRevenue: number;
  currency: string | null;
  averageRating: number | null;
  reviewCount: number;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const fetchListing = (id: string): Promise<FullListing> =>
  listingApi.get(`/listings/${id}`).then((r) => r.data.data ?? r.data);

const fetchSummary = (): Promise<{ listings: ListingSummaryItem[] }> =>
  listingApi.get("/provider/listings/summary").then((r) => r.data.data ?? r.data);

// ── Status helpers ─────────────────────────────────────────────────────────────

function canEdit(status: string) {
  return !["pending_review", "suspended", "auto_suspended", "permanently_banned"].includes(status);
}
function canSubmit(status: string) {
  return ["draft", "rejected"].includes(status);
}
function canActivate(status: string) {
  return ["draft", "deactivated"].includes(status);
}
function canDeactivate(status: string) {
  return ["active", "approved"].includes(status);
}

// ── Amenity icon map ───────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi:      <Wifi className="w-3.5 h-3.5" />,
  parking:   <ParkingSquare className="w-3.5 h-3.5" />,
  gym:       <Dumbbell className="w-3.5 h-3.5" />,
  ac:        <Wind className="w-3.5 h-3.5" />,
  breakfast: <Coffee className="w-3.5 h-3.5" />,
  kitchen:   <UtensilsCrossed className="w-3.5 h-3.5" />,
  workspace: <Laptop className="w-3.5 h-3.5" />,
  pool:      <Waves className="w-3.5 h-3.5" />,
};

// ── Category icon ──────────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: ListingCategory }) {
  if (category === "hotel")     return <Hotel className="w-4 h-4" />;
  if (category === "car")       return <Car className="w-4 h-4" />;
  return <Home className="w-4 h-4" />;
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color = "blue",
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "blue" | "green" | "amber" | "violet";
  sub?: string;
}) {
  const colors = {
    blue:   "bg-primary-50 text-primary",
    green:  "bg-success-light text-success",
    amber:  "bg-warning-light text-warning",
    violet: "bg-violet-100 text-violet-600",
  };

  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5", colors[color])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [activePhoto, setActivePhoto] = useState(0);
  const [confirm, setConfirm] = useState<{ action: string } | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────

  const {
    data: listing,
    isLoading,
    error,
  } = useQuery({
    queryKey: LISTING_QK.detail(id),
    queryFn: () => fetchListing(id),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: summaryData } = useQuery({
    queryKey: LISTING_QK.summary(),
    queryFn: fetchSummary,
    staleTime: 60_000,
    enabled: !!listing,
  });

  const summary = summaryData?.listings.find((l) => l.id === id);

  // ── Mutations ────────────────────────────────────────────────────────────────

  function invalidate() {
    void qc.invalidateQueries({ queryKey: LISTING_QK.all });
    void qc.invalidateQueries({ queryKey: ["provider-dashboard"] });
  }

  const submitMutation = useMutation({
    mutationFn: () => listingsService.submit(id),
    onSuccess: () => { setConfirm(null); invalidate(); },
  });

  const activateMutation = useMutation({
    mutationFn: () => listingsService.activate(id),
    onSuccess: () => { setConfirm(null); invalidate(); },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => listingsService.deactivate(id),
    onSuccess: () => { setConfirm(null); invalidate(); },
  });

  const isMutating =
    submitMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending;

  const actionError =
    submitMutation.error?.message ??
    activateMutation.error?.message ??
    deactivateMutation.error?.message;

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-56" />
          </div>
        </div>
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────

  if (error || !listing) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-12 h-12 bg-danger-light rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-danger" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Listing not found</h2>
        <p className="text-slate-500 mt-2 text-sm">
          This listing may have been deleted or you don&apos;t have access.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard/listings")}
        >
          Back to Listings
        </Button>
      </div>
    );
  }

  const photos = listing.photos ?? [];
  const docs   = listing.documents ?? [];
  const amenities      = (listing.amenities ?? []).map((a) => a.amenityKey);
  const customAmenities= (listing.customAmenities ?? []).map((a) => a.label);
  const coverPhoto = photos[activePhoto]?.cdnUrl ?? photos[0]?.cdnUrl;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">

      {/* ── Breadcrumb + Header ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-4">
        <button
          onClick={() => router.push("/dashboard/listings")}
          className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center text-slate-600 hover:bg-surface-muted transition-all shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Link href="/dashboard/listings" className="hover:text-slate-600 transition-colors">
              Listings
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-600 font-medium truncate">
              {listing.name ?? "Untitled"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 truncate">
            {listing.name ?? "Untitled Listing"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Badge label={listing.status} status={listing.status} dot />
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CategoryIcon category={listing.category} />
              <span className="capitalize">{listing.category}</span>
            </span>
            {listing.town && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {[listing.town, listing.country].filter(Boolean).join(", ")}
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {formatRelativeTime(listing.updatedAt)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canEdit(listing.status) && (
            <Link href={`/dashboard/listings/${id}/edit`}>
              <Button variant="outline" size="sm" icon={<Edit3 />}>
                Edit
              </Button>
            </Link>
          )}
          {canSubmit(listing.status) && (
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowUpRight />}
              onClick={() => setConfirm({ action: "submit" })}
            >
              Submit for Review
            </Button>
          )}
          {canActivate(listing.status) && ["apartment", "car"].includes(listing.category) && (
            <Button
              variant="success"
              size="sm"
              icon={<CheckCircle />}
              onClick={() => setConfirm({ action: "activate" })}
            >
              Activate
            </Button>
          )}
          {canDeactivate(listing.status) && (
            <Button
              variant="secondary"
              size="sm"
              icon={<XCircle />}
              onClick={() => setConfirm({ action: "deactivate" })}
            >
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {/* ── Rejection banner ─────────────────────────────────────────────────── */}
      {listing.rejectionReasons?.length > 0 && (
        <div className="bg-danger-light border border-danger/20 rounded-2xl p-4 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-danger-dark">Listing Rejected</h4>
            {listing.rejectionNote && (
              <p className="text-xs text-danger-dark/80 mt-1">{listing.rejectionNote}</p>
            )}
            <ul className="list-disc pl-4 mt-2 space-y-0.5">
              {listing.rejectionReasons.map((r, i) => (
                <li key={i} className="text-xs text-danger-dark/90">{r}</li>
              ))}
            </ul>
            {canEdit(listing.status) && (
              <Link href={`/dashboard/listings/${id}/edit`}>
                <button className="mt-3 text-xs font-semibold text-danger underline underline-offset-2">
                  Fix & Re-submit →
                </button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── API action error ─────────────────────────────────────────────────── */}
      {actionError && (
        <div className="bg-danger-light border border-danger/20 rounded-xl p-3 text-sm text-danger-dark flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* ── Photo gallery ────────────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          {/* Main image */}
          <div className="relative h-64 md:h-80 bg-slate-100">
            <img
              src={coverPhoto}
              alt={listing.name ?? "Listing photo"}
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <Images className="w-3.5 h-3.5" />
                {activePhoto + 1} / {photos.length}
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto scrollbar-thin">
              {photos.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={() => setActivePhoto(i)}
                  className={cn(
                    "w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all",
                    i === activePhoto ? "border-primary" : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <img
                    src={photo.cdnUrl}
                    alt={`Thumbnail ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Bookings"
          value={summary?.bookingCount ?? 0}
          icon={<BookOpen />}
          color="blue"
        />
        <StatCard
          label="Total Revenue"
          value={
            summary
              ? formatCurrency(summary.totalRevenue, summary.currency ?? "USD")
              : "—"
          }
          icon={<DollarSign />}
          color="green"
          sub="Provider payout"
        />
        <StatCard
          label="Average Rating"
          value={summary?.averageRating ? `${summary.averageRating} ★` : "—"}
          icon={<Star />}
          color="amber"
          sub={summary?.reviewCount ? `${summary.reviewCount} review${summary.reviewCount !== 1 ? "s" : ""}` : undefined}
        />
        <StatCard
          label="Submission Count"
          value={listing.submissionCount}
          icon={<TrendingUp />}
          color="violet"
          sub={listing.submittedAt ? `Last ${formatRelativeTime(listing.submittedAt)}` : "Not yet submitted"}
        />
      </div>

      {/* ── Main content grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column: details */}
        <div className="lg:col-span-2 space-y-5">

          {/* Description */}
          {listing.description && (
            <Card>
              <CardHeader
                title="Description"
                icon={<FileText />}
              />
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </Card>
          )}

          {/* Hotel-specific details */}
          {listing.category === "hotel" && (
            <Card>
              <CardHeader title="Hotel Details" icon={<Hotel />} />
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Room Type",      value: listing.roomType ? slugToLabel(listing.roomType) : "—" },
                  { label: "Total Units",    value: listing.unitCount ?? "—" },
                  { label: "Claimed Stars",  value: listing.claimedStarRating ? `${listing.claimedStarRating} ★` : "—" },
                  { label: "Awarded Stars",  value: listing.starRating ? `${listing.starRating} ★` : "Pending admin" },
                  { label: "Check-in",       value: listing.checkinTime ?? "—" },
                  { label: "Check-out",      value: listing.checkoutTime ?? "—" },
                ].map((d) => (
                  <div key={d.label}>
                    <p className="text-xs font-medium text-slate-400">{d.label}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{d.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Apartment-specific details */}
          {listing.category === "apartment" && (
            <Card>
              <CardHeader title="Apartment Details" icon={<Home />} />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Bedrooms",   value: listing.bedrooms ?? "—", icon: <BedDouble className="w-3.5 h-3.5" /> },
                  { label: "Bathrooms",  value: listing.bathrooms ?? "—", icon: <Bath className="w-3.5 h-3.5" /> },
                  { label: "Max Guests", value: listing.maxGuests ?? "—", icon: <Users className="w-3.5 h-3.5" /> },
                  { label: "Check-in",   value: listing.checkinTime ?? "—" },
                  { label: "Check-out",  value: listing.checkoutTime ?? "—" },
                  {
                    label: "Long Stay",
                    value: listing.longStayEnabled
                      ? `${listing.longStayDiscountValue ?? "?"}${listing.longStayDiscountType === "percentage" ? "%" : " off"} after ${listing.longStayMinNights ?? "?"} nights`
                      : "Disabled",
                  },
                ].map((d) => (
                  <div key={d.label} className="flex items-start gap-1.5">
                    {d.icon && <span className="text-slate-400 mt-0.5">{d.icon}</span>}
                    <div>
                      <p className="text-xs font-medium text-slate-400">{d.label}</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{d.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Car-specific details */}
          {listing.category === "car" && (
            <Card>
              <CardHeader title="Vehicle Details" icon={<Car />} />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Make",         value: listing.carMake ?? "—" },
                  { label: "Model",        value: listing.carModel ?? "—" },
                  { label: "Year",         value: listing.carYear ?? "—" },
                  {
                    label: "Transmission",
                    value: listing.transmission ? slugToLabel(listing.transmission) : "—",
                    icon: <Settings2 className="w-3.5 h-3.5" />,
                  },
                  {
                    label: "Fuel",
                    value: listing.fuelType ? slugToLabel(listing.fuelType) : "—",
                    icon: <Fuel className="w-3.5 h-3.5" />,
                  },
                  {
                    label: "Seats",
                    value: listing.seats ?? "—",
                    icon: <Users className="w-3.5 h-3.5" />,
                  },
                  { label: "Doors",        value: listing.doors ?? "—" },
                  {
                    label: "Mileage",
                    value: listing.mileagePolicy === "limited"
                      ? `${listing.mileageLimitKm ?? "?"} km/day`
                      : "Unlimited",
                  },
                ].map((d) => (
                  <div key={d.label} className="flex items-start gap-1.5">
                    {d.icon && <span className="text-slate-400 mt-0.5">{d.icon}</span>}
                    <div>
                      <p className="text-xs font-medium text-slate-400">{d.label}</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{d.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Amenities */}
          {(amenities.length > 0 || customAmenities.length > 0) && (
            <Card>
              <CardHeader title="Amenities & Features" icon={<Award />} />
              <div className="flex flex-wrap gap-2">
                {amenities.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 border border-primary-100 text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {AMENITY_ICONS[key] ?? null}
                    {slugToLabel(key)}
                  </span>
                ))}
                {customAmenities.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Documents (hotel only) */}
          {listing.category === "hotel" && docs.length > 0 && (
            <Card>
              <CardHeader title="Verification Documents" icon={<Globe />} />
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-border"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {slugToLabel(doc.documentType)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {doc.fileType?.toUpperCase() ?? "Document"}
                      </p>
                    </div>
                    <Badge label="Uploaded" status="active" />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right column: sidebar info */}
        <div className="space-y-5">

          {/* Pricing & policies */}
          <Card>
            <CardHeader title="Pricing & Policies" icon={<DollarSign />} />
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-slate-500">
                  {listing.category === "car" ? "Daily Rate" : "Per Night"}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {listing.pricePerNight
                    ? formatCurrency(Number(listing.pricePerNight), listing.currency ?? "USD")
                    : "—"}
                </span>
              </div>
              {[
                {
                  label: "Cancellation",
                  value: listing.cancellationPolicy
                    ? slugToLabel(listing.cancellationPolicy)
                    : "—",
                },
                {
                  label: "Min Stay",
                  value: listing.minStayNights ? `${listing.minStayNights} night(s)` : "—",
                },
                {
                  label: "Smoking",
                  value: listing.smokingAllowed ? "Allowed" : "Not allowed",
                },
                {
                  label: "Pets",
                  value: listing.petsAllowed ? "Allowed" : "Not allowed",
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{row.label}</span>
                  <span className="text-xs font-semibold text-slate-700">{row.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader title="Location" icon={<MapPin />} />
            <div className="space-y-2">
              {[
                { label: "Address", value: listing.address },
                { label: "Town / City", value: listing.town },
                { label: "Country", value: listing.country },
              ]
                .filter((r) => r.value)
                .map((r) => (
                  <div key={r.label}>
                    <p className="text-xs font-medium text-slate-400">{r.label}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{r.value}</p>
                  </div>
                ))}
              {listing.lat && listing.lng && (
                <p className="text-xs text-slate-400">
                  {Number(listing.lat).toFixed(5)}, {Number(listing.lng).toFixed(5)}
                </p>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Activity" icon={<Clock />} />
            <div className="space-y-3">
              {[
                { label: "Created",   value: formatDate(listing.createdAt) },
                { label: "Updated",   value: formatDate(listing.updatedAt) },
                {
                  label: "Submitted",
                  value: listing.submittedAt ? formatDate(listing.submittedAt) : "—",
                },
                {
                  label: "Activated",
                  value: listing.activatedAt ? formatDate(listing.activatedAt) : "—",
                },
              ].map((e) => (
                <div key={e.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{e.label}</span>
                  <span className="text-xs font-semibold text-slate-700">{e.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader title="Quick Actions" icon={<Settings2 />} />
            <div className="space-y-2">
              {canEdit(listing.status) && (
                <Link href={`/dashboard/listings/${id}/edit`} className="block">
                  <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-surface-muted transition-all group">
                    <span className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                      Edit Listing
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                  </button>
                </Link>
              )}
              {canSubmit(listing.status) && (
                <button
                  onClick={() => setConfirm({ action: "submit" })}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-primary-50 transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Submit for Review
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              )}
              {canActivate(listing.status) &&
                ["apartment", "car"].includes(listing.category) && (
                  <button
                    onClick={() => setConfirm({ action: "activate" })}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-success hover:bg-success-light transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Activate Listing
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                  </button>
                )}
              {canDeactivate(listing.status) && (
                <button
                  onClick={() => setConfirm({ action: "deactivate" })}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-warning hover:bg-warning-light transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Deactivate
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              )}
              <Link href="/dashboard/bookings" className="block">
                <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-surface-muted transition-all group">
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                    View Bookings
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                </button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Confirm modal ─────────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.action === "submit")     submitMutation.mutate();
          if (confirm.action === "activate")   activateMutation.mutate();
          if (confirm.action === "deactivate") deactivateMutation.mutate();
        }}
        title={
          confirm?.action === "submit"
            ? "Submit for review?"
            : confirm?.action === "activate"
              ? "Activate listing?"
              : "Deactivate listing?"
        }
        message={
          confirm?.action === "submit"
            ? "Your listing will be sent to our review team. This may take up to 48 hours."
            : confirm?.action === "activate"
              ? "Your listing will go live and be visible to guests immediately."
              : "This listing will be hidden from guests. You can reactivate it any time."
        }
        variant={confirm?.action === "deactivate" ? "danger" : "primary"}
        confirmLabel={
          confirm?.action === "submit"
            ? "Submit"
            : confirm?.action === "activate"
              ? "Activate"
              : "Deactivate"
        }
        loading={isMutating}
      />
    </div>
  );
}
