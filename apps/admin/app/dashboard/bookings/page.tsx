"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, XCircle, Plus, Send } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ConfirmModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime, formatCurrency, slugToLabel } from "@/lib/utils";
import type { Booking } from "@/types/admin";

import { canAccess } from "@/permissions/rbac";
import type { AdminRole } from "@/types/admin";

const COUNTRY_OPTIONS = [
  "MT", "US", "GB", "DE", "FR", "ES", "IT", "AE", "AU", "CA", "JP", "SG", "NL", "BE", "SE", "IN",
].map((c) => ({ value: c, label: c }));

const fetchBookings = (params: Record<string, string>) =>
  listingApi.get(`/admin/bookings?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

const fetchBookingDetail = (id: string) =>
  listingApi.get(`/admin/bookings/${id}`).then((r) => r.data.data ?? r.data);

export default function BookingsPage() {
  const qc = useQueryClient();
  const { token, user, _hasHydrated } = useAuthStore();
  const role = user?.role as AdminRole | undefined;
  const isAdminOrSuperAdmin = user?.role === "super_admin" || user?.role === "admin";
  const isCountryManager = user?.role === "country_manager";
  const canManualBook = canAccess(role, "manage_manual_booking");
  // Only super_admin and admin see the country filter dropdown; country managers have a fixed scope
  const canShowCountryFilter = user?.role === "super_admin" || user?.role === "admin";

  // scopedCountries only applies to country_manager (not admin — admin sees all)
  const scopedCountries: string[] = isCountryManager ? (user?.countryScope ?? []) : [];
  
  const countryOptions = scopedCountries.length > 0
    ? scopedCountries.map((c) => ({ value: c, label: c }))
    : COUNTRY_OPTIONS;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [listingType, setListingType] = useState("");
  const [country, setCountry] = useState(() => scopedCountries[0] ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sync country selection after auth store hydration
  useEffect(() => {
    if (scopedCountries.length > 0 && !country) {
      setCountry(scopedCountries[0] ?? "");
    }
  }, [scopedCountries, country]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelModal, setCancelModal] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  

  

  // Set default status for Sales role
  useEffect(() => {
    if (role === "sales" && status === "") {
      setStatus("pending_payment");
    }
  }, [role, status]);

  const canCreateManualBooking = canAccess(role as AdminRole, "manage_manual_booking");

  // ✅ no duplicate arrays, no any[]
  const statusOptions =
    role === "sales"
      ? [{ value: "pending_payment", label: "Pending Requests" }]
      : [
          { value: "pending_payment", label: "Pending Payment" },
          { value: "confirmed", label: "Confirmed" },
          { value: "completed", label: "Completed" },
          { value: "cancelled_by_guest", label: "Cancelled by Guest" },
          { value: "cancelled_by_provider", label: "Cancelled by Provider" },
          { value: "cancelled_by_system", label: "Cancelled by System" },
        ];

  const filterItems = [
    {
      key: "status",
      label: role === "sales" ? "Pending Requests" : "All Statuses",
      value: status,
      onChange: (v: string) => { setStatus(v); setPage(1); },
      options: statusOptions,
    },
    {
      key: "listingType",
      label: "All Types",
      value: listingType,
      onChange: (v: string) => { setListingType(v); setPage(1); },
      options: [
        { value: "hotel", label: "Hotel" },
        { value: "apartment", label: "Apartment" },
        { value: "car", label: "Car" },
      ],
    },
    ...(canShowCountryFilter
      ? [
          {
            key: "country",
            label: "All Countries",
            value: country,
            onChange: (v: string) => { setCountry(v); setPage(1); },
            options: countryOptions,
          },
        ]
      : []),
  ];

  // For country managers, always enforce their scoped country
  const effectiveCountry = isCountryManager ? (country || scopedCountries[0] || "") : country;
  const params = Object.fromEntries(
    Object.entries({
      q,
      status,
      listingType,
      country: effectiveCountry,
      page: String(page),
      limit: String(limit),
    }).filter(([, v]) => v !== "")
  );


  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", params],
    queryFn: () => fetchBookings(params),
    // Wait for auth store to rehydrate so scopedCountries/effectiveCountry are correct
    enabled: !!token && _hasHydrated,
  });

  const bookings: Booking[] = data?.bookings ?? [];
  const total: number = data?.total ?? 0;

  const offset = (page - 1) * limit;
  const requestUrl = `/admin/bookings?${new URLSearchParams(params)}`;
  const responseCount = data?.bookings?.length ?? 0;
  const renderedRows = bookings.length;
  console.log("BookingsPage Pagination Debug:", {
    page,
    limit: limit,
    offset,
    params,
    queryKey: ["admin-bookings", page, limit, q, status, listingType, effectiveCountry],
    requestUrl,
    responseCount,
    renderedRows,
  });

  const { data: detailData, isLoading: loadingDetail } = useQuery({
    queryKey: ["admin-booking-detail", selected?.id],
    queryFn: () => fetchBookingDetail(selected!.id),
    enabled: !!selected,
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      listingApi.post(`/admin/bookings/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-detail"] });
      setCancelModal(null);
      setCancelReason("");
    },
  });

  // Resend payment link for draft bookings
  const resendLinkMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/admin/bookings/${id}/send-link`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
  });

  const columns: Column<Booking>[] = [
    {
      key: "ref",
      label: "Reference",
      width: "160px",
      render: (b) => (
        <div>
          <p className="font-mono font-medium text-sm text-primary">{b.reference}</p>
          <p className="text-xs text-slate-500 capitalize">{b.listingType}</p>
        </div>
      ),
    },
    {
      key: "guest",
      label: "Guest",
      render: (b) => (
        <div>
          <p className="font-medium text-sm text-slate-900">{b.guestFirstName} {b.guestLastName}</p>
          <p className="text-xs text-slate-500">{b.guestEmail}</p>
        </div>
      ),
    },
    {
      key: "listing",
      label: "Listing",
      render: (b) => (
        <span className="text-sm text-slate-700 truncate">{b.listing?.name ?? b.listingId}</span>
      ),
    },
    {
      key: "dates",
      label: "Dates",
      render: (b) => (
        <div className="text-xs text-slate-600">
          {b.checkIn ? (
            <>{formatDate(b.checkIn, "MMM d")} → {formatDate(b.checkOut, "MMM d")}</>
          ) : (
            <>{formatDate(b.pickupDatetime, "MMM d HH:mm")}</>
          )}
          <div className="text-slate-400">{b.nightsOrDays} {b.listingType === "car" ? "day(s)" : "night(s)"}</div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (b) => (
        <div className="text-right">
          <p className="font-semibold text-sm tabular">{formatCurrency(Number(b.totalAmount), b.currency)}</p>
          <p className="text-xs text-slate-500">Commission: {formatCurrency(Number(b.commissionAmount), b.currency)}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (b) => <Badge label={b.status} status={b.status} />,
    },
    {
      key: "created",
      label: "Booked",
      render: (b) => <span className="text-xs text-slate-500">{formatRelativeTime(b.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: "80px",
      render: (b) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {["pending_payment", "confirmed"].includes(b.status) && role !== "sales" && (
            <button
              onClick={() => setCancelModal(b)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
              title="Cancel booking"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
          {["pending_payment", "draft"].includes(b.status) && (
            <button
              onClick={() => resendLinkMut.mutate(b.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
              title="Resend payment link"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-2xl">
      <SectionHeader
        title="Bookings"
        description={`${total.toLocaleString()} total bookings`}
        action={
          canManualBook ? (
            <Link href="/dashboard/bookings/new">
              <Button leftIcon={<Plus className="h-4 w-4" />}>
                Manual Booking
              </Button>
            </Link>
          ) : undefined
        }
      />

      <Card padding="none">
        <FilterBar 
        
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search reference, email…"
          filters={filterItems}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={bookings}
          loading={isLoading}
          onRowClick={(b) => setSelected(b)}
          emptyTitle="No bookings found"
          emptyDescription="Try adjusting your search or filters."
          emptyIcon={<CalendarDays className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Booking detail drawer */}
      {selected && (
        <SlideDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={`Booking ${selected.reference}`}
        >
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading…</div>
          ) : detailData ? (
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Guest</p>
                  <p className="text-sm font-semibold text-slate-900">{detailData.guestFirstName} {detailData.guestLastName}</p>
                  <p className="text-xs text-slate-500">{detailData.guestEmail}</p>
                  {detailData.guestPhone && <p className="text-xs text-slate-500">{detailData.guestPhone}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Status</p>
                  <Badge label={detailData.status} status={detailData.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Listing</p>
                  <p className="text-sm text-slate-800">{detailData.listing?.name ?? detailData.listingId}</p>
                  <p className="text-xs text-slate-500 capitalize">{detailData.listingType}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Dates</p>
                  {detailData.checkIn ? (
                    <p className="text-sm text-slate-800">
                      {formatDate(detailData.checkIn, "MMM d, yyyy")} → {formatDate(detailData.checkOut, "MMM d, yyyy")}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-800">
                      {formatDate(detailData.pickupDatetime, "MMM d HH:mm")}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">{detailData.nightsOrDays} {detailData.listingType === "car" ? "day(s)" : "night(s)"}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Financials</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span>{formatCurrency(Number(detailData.subtotal), detailData.currency)}</span>
                  </div>
                  {Number(detailData.discountAmount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Discount</span>
                      <span className="text-green-600">−{formatCurrency(Number(detailData.discountAmount), detailData.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1">
                    <span>Total</span>
                    <span>{formatCurrency(Number(detailData.totalAmount), detailData.currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Commission</span>
                    <span>{formatCurrency(Number(detailData.commissionAmount), detailData.currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Provider Payout</span>
                    <span>{formatCurrency(Number(detailData.providerPayout), detailData.currency)}</span>
                  </div>
                </div>
              </div>

              {["pending_payment", "confirmed"].includes(detailData.status) && role !== "sales" && (
                <div className="border-t border-border pt-4">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => { setCancelModal(selected); setSelected(null); }}
                  >
                    Cancel Booking
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </SlideDrawer>
      )}

      {/* Cancel confirmation modal */}
      {cancelModal && (
        <ConfirmModal
          open={!!cancelModal}
          onClose={() => { setCancelModal(null); setCancelReason(""); }}
          title="Cancel Booking"
          description={`Cancel booking ${cancelModal.reference}? This action cannot be undone.`}
          confirmLabel="Cancel Booking"
          variant="danger"
          loading={cancelMut.isPending}
          onConfirm={() => cancelMut.mutate({ id: cancelModal.id, reason: cancelReason })}
        >
          <Textarea
            label="Cancellation reason"
            placeholder="Provide a reason for cancellation…"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
        </ConfirmModal>
      )}
    </div>
  );
}
