"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, XCircle } from "lucide-react";
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

const fetchBookings = (params: Record<string, string>) =>
  listingApi.get("/admin/bookings", { params }).then((r) => r.data.data ?? r.data);

const fetchBookingDetail = (id: string) =>
  listingApi.get(`/admin/bookings/${id}`).then((r) => r.data.data ?? r.data);

export default function BookingsPage() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [listingType, setListingType] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  
   const { user, _hasHydrated } = useAuthStore();

const isCountryManager = user?.role === "country_manager";

const scopedCountries = useMemo(() => {
  return isCountryManager ? (user?.countryScope ?? []) : [];
}, [isCountryManager, user?.countryScope]);

const canShowCountryFilter = user?.role === "super_admin" || user?.role === "admin";
const countryOptions = [
  "MT", "US", "GB", "DE", "FR", "ES", "IT", "AE", "AU", "CA", "JP", "SG", "NL", "BE", "SE", "IN"
].map((c) => ({ value: c, label: c }));

useEffect(() => {
  if (!_hasHydrated) return;

  if (scopedCountries.length > 0 && !country) {
  setCountry(scopedCountries[0] ?? "");
  }
}, [_hasHydrated, scopedCountries, country]);

  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelModal, setCancelModal] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const role = useAuthStore(state => state.user?.role);

  // Set default status for Sales role
  useEffect(() => {
    if (role === "sales" && status === "") {
      setStatus("pending_payment");
    }
  }, [role, status]);

  // ✅ FIXED: no duplicate arrays, no any[]
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
    {
      key: "rowsPerPage",
      label: "",
      value: String(rowsPerPage),
      onChange: (v: string) => { setRowsPerPage(Number(v)); setPage(1); },
      options: [
        { value: "5", label: "5" },
        { value: "10", label: "10" },
        { value: "20", label: "20" },
        { value: "50", label: "50" },
      ],
    },
  ];

  const effectiveCountry = isCountryManager ? (country || scopedCountries[0] || "") : country;
  const params = Object.fromEntries(
    Object.entries({
      q,
      status,
      listingType,
      country: effectiveCountry,
      page: String(page),
      limit: String(rowsPerPage),
    }).filter(([, v]) => v !== "")
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", page, rowsPerPage, q, status, listingType, effectiveCountry],
    queryFn: () => fetchBookings(params),
    enabled: _hasHydrated && (!isCountryManager || scopedCountries.length > 0),
  });

  const rawBookings: Booking[] = data?.bookings ?? [];
  const bookings = isCountryManager && scopedCountries.length > 0
    ? rawBookings.filter((b) => {
        const listingCountry = b.listing?.country?.toUpperCase();
        return listingCountry ? scopedCountries.some((sc) => sc.toUpperCase() === listingCountry) : false;
      })
    : rawBookings;
  const total: number = data?.total ?? 0;

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
          {['pending_payment', 'confirmed'].includes(b.status) && role !== 'sales' && (
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
          onSearchChange={(v: string) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search reference, email…"
          filters={filterItems}
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

        <Pagination page={page} limit={rowsPerPage} total={total} onPageChange={setPage} />
      </Card>

      {/* rest of your code unchanged */}
    </div>
  );
}