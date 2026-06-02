"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Calendar, Mail, Phone } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, formatDateTime, formatCurrency, slugToLabel } from "@/lib/utils";
import type { ProviderBooking } from "@/types/provider";

const fetchBookings = (params: Record<string, string>) =>
  listingApi
    .get(`/provider/bookings?${new URLSearchParams(params)}`)
    .then((r) => r.data.data ?? r.data);

const STATUS_OPTIONS = [
  { value: "confirmed",             label: "Confirmed" },
  { value: "completed",             label: "Completed" },
  { value: "pending_payment",       label: "Pending Payment" },
  { value: "cancelled_by_guest",    label: "Cancelled by Guest" },
  { value: "cancelled_by_provider", label: "Cancelled by Provider" },
  { value: "cancelled_by_system",   label: "Cancelled by System" },
];

export default function BookingsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ProviderBooking | null>(null);

  const params = { search, status, offset: String(offset), limit: "20" };
  const { data, isLoading } = useQuery({
    queryKey: ["provider-bookings", params],
    queryFn:  () => fetchBookings(params),
  });

  const bookings: ProviderBooking[] = data?.bookings ?? [];
  const total: number = data?.total ?? 0;

  const columns: Column<ProviderBooking>[] = [
    {
      key: "guest",
      label: "Guest",
      width: "220px",
      render: (b) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={`${b.guestFirstName} ${b.guestLastName}`} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {b.guestFirstName} {b.guestLastName}
            </p>
            <p className="text-xs text-slate-500 truncate">{b.reference}</p>
          </div>
        </div>
      ),
    },
    {
      key: "listing",
      label: "Listing",
      render: (b) => (
        <div className="min-w-0">
          <p className="text-sm text-slate-900 truncate max-w-[160px]">{b.listingTitle ?? "—"}</p>
          <span className="text-xs text-slate-400 capitalize">{b.listingCategory}</span>
        </div>
      ),
    },
    {
      key: "dates",
      label: "Dates",
      render: (b) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {b.checkIn ? (
              <span>{formatDate(b.checkIn)} → {formatDate(b.checkOut)}</span>
            ) : b.pickupDatetime ? (
              <span>{formatDateTime(b.pickupDatetime)}</span>
            ) : "—"}
          </div>
          <span className="text-slate-400">{b.nightsOrDays} night{b.nightsOrDays !== 1 ? "s" : ""}/day{b.nightsOrDays !== 1 ? "s" : ""}</span>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Payout",
      render: (b) => (
        <div>
          <p className="text-sm font-bold text-slate-900">
            {formatCurrency(b.providerPayout, b.currency)}
          </p>
          <p className="text-xs text-slate-400">
            of {formatCurrency(b.totalAmount, b.currency)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (b) => <Badge label={b.status} status={b.status} dot />,
    },
    {
      key: "date",
      label: "Booked",
      render: (b) => <span className="text-xs text-slate-400">{formatDate(b.createdAt)}</span>,
    },
    {
      key: "view",
      label: "",
      render: (b) => (
        <button
          onClick={() => setSelected(b)}
          className="text-xs font-medium text-primary hover:underline"
        >
          Details
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Bookings"
        subtitle={`${total} total booking${total !== 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <BookOpen className="w-4 h-4" />
            Real-time data
          </div>
        }
      />

      <Card padding="none">
        <div className="p-4 border-b border-border">
          <FilterBar
            search={search}
            onSearch={(v) => { setSearch(v); setOffset(0); }}
            searchPlaceholder="Search by guest or reference…"
            filters={[
              {
                key: "status",
                value: status,
                onChange: (v) => { setStatus(v); setOffset(0); },
                placeholder: "All statuses",
                options: STATUS_OPTIONS,
              },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={bookings}
          keyExtractor={(b) => b.id}
          loading={isLoading}
          emptyTitle="No bookings found"
          emptyMessage="Bookings will appear here once guests book your listings."
        />

        <Pagination total={total} limit={20} offset={offset} onOffsetChange={setOffset} />
      </Card>

      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Booking Details"
        subtitle={selected?.reference}
        width="lg"
      >
        {selected && (
          <div className="space-y-5">
            <Badge label={selected.status} status={selected.status} dot />

            <div className="bg-surface-muted rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Guest</p>
              <div className="flex items-center gap-3">
                <Avatar name={`${selected.guestFirstName} ${selected.guestLastName}`} size="md" />
                <div>
                  <p className="font-semibold text-slate-900">{selected.guestFirstName} {selected.guestLastName}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Mail className="w-3 h-3" />
                    {selected.guestEmail}
                  </div>
                  {selected.guestPhone && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone className="w-3 h-3" />
                      {selected.guestPhone}
                    </div>
                  )}
                </div>
              </div>
              {(selected.adults || selected.children) && (
                <p className="text-xs text-slate-500">
                  {selected.adults ?? 0} adult{(selected.adults ?? 0) !== 1 ? "s" : ""}
                  {selected.children ? `, ${selected.children} child${selected.children !== 1 ? "ren" : ""}` : ""}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 font-medium">Check-in / Pickup</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {formatDate(selected.checkIn ?? selected.pickupDatetime)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Check-out / Return</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {formatDate(selected.checkOut ?? selected.returnDatetime)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Duration</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {selected.nightsOrDays} night{selected.nightsOrDays !== 1 ? "s" : ""}/day{selected.nightsOrDays !== 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Policy</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {slugToLabel(selected.cancellationPolicy)}
                </p>
              </div>
            </div>

            <div className="bg-surface-muted rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment</p>
              {[
                { label: "Total charged", value: formatCurrency(selected.totalAmount, selected.currency) },
                { label: "Commission",    value: `-${formatCurrency(selected.commissionAmount, selected.currency)}` },
                { label: "Your payout",   value: formatCurrency(selected.providerPayout, selected.currency), bold: true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{row.label}</span>
                  <span className={row.bold ? "text-sm font-bold text-slate-900" : "text-sm text-slate-700"}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {selected.specialRequests && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Special Requests</p>
                <p className="text-sm text-slate-700 bg-surface-muted p-3 rounded-xl leading-relaxed">
                  {selected.specialRequests}
                </p>
              </div>
            )}

            {selected.cancelledAt && (
              <div className="bg-danger-light border border-danger/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-danger mb-1">Cancelled</p>
                <p className="text-xs text-danger-dark">On {formatDateTime(selected.cancelledAt)}</p>
                {selected.cancellationReason && (
                  <p className="text-xs text-danger-dark mt-1">{selected.cancellationReason}</p>
                )}
              </div>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
