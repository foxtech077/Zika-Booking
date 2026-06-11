"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, XCircle, Eye } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ActionModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime, formatCurrency, slugToLabel } from "@/lib/utils";
import type { Booking } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";

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
  const isAdminOrSuperAdmin = user?.role === "super_admin" || user?.role === "admin";
  const isCountryManager = user?.role === "country_manager";
  // Only super_admin and admin see the country filter dropdown; country managers have a fixed scope
  const canShowCountryFilter = user?.role === "super_admin" || user?.role === "admin";

  // scopedCountries only applies to country_manager (not admin — admin sees all)
  const scopedCountries = isCountryManager ? (user?.countryScope ?? []) : [];
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
      setCountry(scopedCountries[0]);
    }
  }, [scopedCountries, country]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelModal, setCancelModal] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");

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

  const filteredBookings = bookings.filter((b) => {
    if (!startDate && !endDate) return true;
    const dateStr = b.checkIn || b.pickupDatetime || b.createdAt;
    if (!dateStr) return true;
    const bookingDate = new Date(dateStr);

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (bookingDate < start) return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (bookingDate > end) return false;
    }

    return true;
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
          {["pending_payment", "confirmed"].includes(b.status) && (
            <button
              onClick={() => setCancelModal(b)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
              title="Cancel booking"
            >
              <XCircle className="h-3.5 w-3.5" />
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
      />

      <Card padding="none">
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search reference, email…"
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "pending_payment", label: "Pending Payment" },
                { value: "confirmed", label: "Confirmed" },
                { value: "completed", label: "Completed" },
                { value: "cancelled_by_guest", label: "Cancelled by Guest" },
                { value: "cancelled_by_provider", label: "Cancelled by Provider" },
                { value: "cancelled_by_system", label: "Cancelled by System" },
              ],
            },
            {
              key: "listingType",
              label: "All Types",
              value: listingType,
              onChange: (v) => { setListingType(v); setPage(1); },
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
                    onChange: (v: string) => {
                      setCountry(v);
                      setPage(1);
                    },
                    options: countryOptions,
                  },
                ]
              : []),
          ]}
        >
          {canShowCountryFilter && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="py-1.5 px-3 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[38px]"
                aria-label="Start Date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="py-1.5 px-3 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[38px]"
                aria-label="End Date"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setPage(1);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xs"
                  title="Clear date filter"
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </FilterBar>
        <DataTable
          columns={columns}
          data={filteredBookings}
          loading={isLoading}
          onRowClick={(b) => setSelected(b)}
          emptyTitle="No bookings found"
          emptyDescription="Try adjusting your search or filters."
          emptyIcon={<CalendarDays className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={(newL) => { setLimit(newL); setPage(1); }} />
      </Card>

      {/* Detail drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Booking ${selected?.reference}`}
        description={`${selected?.guestFirstName} ${selected?.guestLastName} · ${selected?.guestEmail}`}
        width="md"
        footer={
          selected && ["pending_payment", "confirmed"].includes(selected.status) ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => { setCancelModal(selected); setSelected(null); }}
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Cancel Booking
            </Button>
          ) : undefined
        }
      >
        {loadingDetail ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-slate-200 rounded animate-shimmer" />
            ))}
          </div>
        ) : detailData ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Reference", detailData.reference],
                ["Status", ""],
                ["Type", detailData.listingType],
                ["Nights/Days", detailData.nightsOrDays],
                ["Check-in", formatDate(detailData.checkIn)],
                ["Check-out", formatDate(detailData.checkOut)],
                ["Adults", detailData.adults ?? "—"],
                ["Children", detailData.children ?? "—"],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-slate-400 mb-0.5">{k}</dt>
                  <dd className="font-medium text-slate-900">
                    {k === "Status" ? <Badge label={detailData.status} status={detailData.status} /> : String(v)}
                  </dd>
                </div>
              ))}
            </div>

            {/* Financials */}
            <div className="bg-surface-subtle rounded-xl p-4 space-y-2 text-sm border border-border">
              <p className="font-semibold text-slate-900 mb-2">Financial Breakdown</p>
              {[
                ["Subtotal", formatCurrency(Number(detailData.subtotal), detailData.currency)],
                ["Voucher Discount", `- ${formatCurrency(Number(detailData.voucherDiscount), detailData.currency)}`],
                ["Delivery Fee", formatCurrency(Number(detailData.deliveryFee), detailData.currency)],
                ["Total", formatCurrency(Number(detailData.totalAmount), detailData.currency)],
                ["Commission", formatCurrency(Number(detailData.commissionAmount), detailData.currency)],
                ["Provider Payout", formatCurrency(Number(detailData.providerPayout), detailData.currency)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between">
                  <span className={k === "Total" ? "font-semibold text-slate-900" : "text-slate-500"}>{k}</span>
                  <span className={k === "Total" ? "font-bold text-slate-900 tabular" : "tabular text-slate-700"}>{String(v)}</span>
                </div>
              ))}
            </div>

            {/* Status log */}
            {detailData.statusLog?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Status History</p>
                <div className="relative">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-3 pl-6">
                    {detailData.statusLog.map((log: any) => (
                      <div key={log.id} className="relative">
                        <div className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-primary" />
                        <p className="text-sm font-medium text-slate-900">
                          {log.fromStatus ? `${slugToLabel(log.fromStatus)} → ` : ""}
                          {slugToLabel(log.toStatus)}
                        </p>
                        {log.reason && <p className="text-xs text-slate-500">{log.reason}</p>}
                        <p className="text-xs text-slate-400">{formatRelativeTime(log.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SlideDrawer>

      {/* Cancel booking modal */}
      <ActionModal
        open={!!cancelModal}
        onClose={() => { setCancelModal(null); setCancelReason(""); }}
        title="Cancel booking"
        description={`Cancel booking ${cancelModal?.reference}? This cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCancelModal(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={cancelMut.isPending}
              onClick={() => cancelModal && cancelMut.mutate({ id: cancelModal.id, reason: cancelReason })}
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Confirm Cancellation
            </Button>
          </>
        }
      >
        <Textarea
          id="cancel-reason"
          label="Cancellation reason"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Explain why this booking is being cancelled…"
          required
          rows={3}
        />
      </ActionModal>
    </div>
  );
}
