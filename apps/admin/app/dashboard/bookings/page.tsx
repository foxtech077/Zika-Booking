"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, XCircle, Plus, Send, MessageSquare } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { paymentApi } from "@/lib/payment-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";

import { formatDate, formatRelativeTime, formatCurrency, slugToLabel } from "@/lib/utils";
import Link from 'next/link';
import { CurrencySymbol } from "@/components/CurrencySymbol";
import type { Booking } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";
import type { AdminRole } from "@/types/admin";
import { DatePicker } from "@/components/ui/DatePicker";
import { SYSTEM_COUNTRIES } from "@/lib/countries";

const COUNTRY_OPTIONS = [
  "MT", "US", "GB", "DE", "FR", "ES", "IT", "AE", "AU", "CA", "JP", "SG", "NL", "BE", "SE", "IN",
].map((code) => {
  const found = SYSTEM_COUNTRIES.find((sc) => sc.code === code);
  return {
    value: code,
    label: found ? `${found.flag} ${found.name}` : code,
  };
});

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
  // scopedCountries only applies to country_manager (not admin — admin sees all)
  const scopedCountries = isCountryManager ? (user?.countryScope ?? []) : [];
  const canShowCountryFilter = user?.role === "super_admin" || user?.role === "admin" || (user?.role === "country_manager" && scopedCountries.length > 1);
  const countryOptions = scopedCountries.length > 0
    ? scopedCountries.map((c) => {
        const found = SYSTEM_COUNTRIES.find((sc) => sc.code === c);
        return { value: c, label: found ? `${found.flag} ${found.name}` : c };
      })
    : COUNTRY_OPTIONS;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [listingType, setListingType] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelModal, setCancelModal] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [resendModal, setResendModal] = useState<Booking | null>(null);
  const [resendError, setResendError] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);
  const [showMessagingDrawer, setShowMessagingDrawer] = useState(false);

  

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

  const params = Object.fromEntries(
    Object.entries({
      q,
      status,
      listingType,
      country,
      page: String(page),
      limit: String(limit),
    }).filter(([, v]) => v !== "")
  );
  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", params],
    queryFn: () => fetchBookings(params),
    // Wait for auth store to rehydrate so scopedCountries are correct
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

  // Resend payment link for draft bookings
  const resendLinkMut = useMutation({
    mutationFn: async ({ id, gateway }: { id: string; gateway: "stripe" | "tara" }) => {
      setResendError("");
      setResendSuccess(false);
      const res = await paymentApi.post(`/${gateway}/payment-link`, { bookingId: id });
      return res.data;
    },
    onSuccess: () => {
      setResendSuccess(true);
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-detail"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? "Failed to send payment link.";
      setResendError(msg);
    }
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
          <p className="font-semibold text-sm tabular">
            <CurrencySymbol currency={b.currency} className="mr-0.5 text-slate-500" />
            {Number(b.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {role !== "sales" && role !== "support" && (
            <p className="text-xs text-slate-500">Commission: <CurrencySymbol currency={b.currency} className="mr-0.5" />{Number(b.commissionAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          )}
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
          {["pending_payment", "draft"].includes(b.status) && (
            <button
              onClick={() => setResendModal(b)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
              title="Resend payment link"
            
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
              <DatePicker
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  setPage(1);
                }}
                placeholder="Start Date"
                className="w-40"
              />
              <span className="text-xs text-slate-400">to</span>
              <DatePicker
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  setPage(1);
                }}
                placeholder="End Date"
                className="w-40"
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
          </div>
        )}
        </SlideDrawer>

        {detailData && "pending_payment".includes(detailData.status) && (
          <div className="border-t border-border pt-4 flex gap-2">
            {canAccess(role as AdminRole, "manage_bookings") && selected && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => { setCancelModal(selected); setSelected(null); }}
              >
                Cancel Booking
              </Button>
            )}
            {canAccess(role as AdminRole, "view_messaging") && selected && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<MessageSquare className="h-3 w-3" />}
                onClick={() => { setShowMessagingDrawer(true); setSelected(selected); }}
              >
                Message Guest
              </Button>
            )}
          </div>
        )}        {/* Messaging Drawer */}
        <SlideDrawer
          open={showMessagingDrawer}
          onClose={() => setShowMessagingDrawer(false)}
          title="Messaging"
          description="Guest communication"
          width="md"
        >
          <MessagingPage />
        </SlideDrawer>
      {/* Resend Payment Link Modal */}
      {resendModal && (
        <ConfirmModal
          open={!!resendModal}
          onClose={() => { setResendModal(null); setResendError(""); setResendSuccess(false); }}
          title="Resend Payment Link"
          description={`Send a new payment link to ${resendModal.guestEmail}?`}
          confirmLabel="Send Link"
          variant="info"
          loading={resendLinkMut.isPending}
          onConfirm={() => resendLinkMut.mutate({ id: resendModal.id, gateway: "stripe" })}
        >
          {resendError && <p className="text-sm text-danger mt-2">{resendError}</p>}
          {resendSuccess && <p className="text-sm text-success mt-2">Payment link sent successfully!</p>}
        </ConfirmModal>
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
