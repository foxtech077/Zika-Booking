"use client";

import { useState, useEffect, useMemo } from "react";
import { parsePhoneNumber } from "libphonenumber-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  XCircle,
  Plus,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock
} from "lucide-react";
import Link from "next/link";
import { listingApi } from "@/lib/listing-api";
import { paymentApi } from "@/lib/payment-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ActionModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime, slugToLabel } from "@/lib/utils";
import { useEurRates, EurValue, formatEur } from "@/lib/eur";
import type { Booking } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";
import type { AdminRole } from "@/types/admin";
import { DatePicker } from "@/components/ui/DatePicker";
import { SYSTEM_COUNTRIES } from "@/lib/countries";
import { Avatar } from "@/components/ui/Avatar";

const COUNTRY_OPTIONS = [
  "MT", "US", "GB", "DE", "FR", "ES", "IT", "AE", "AU", "CA", "JP", "SG", "NL", "BE", "SE", "IN",
].map((code) => {
  const found = SYSTEM_COUNTRIES.find((sc) => sc.code === code);
  return {
    value: code,
    label: found ? `${found.flag} ${found.name}` : code,
  };
});

const COUNTRY_NETWORKS: Record<string, { value: string; label: string }[]> = {
  BJ: [{ value: "mtn", label: "MTN MoMo" }, { value: "orange", label: "Orange Money" }, { value: "moov", label: "Moov Money" }],
  BF: [{ value: "wave", label: "Wave Money" }, { value: "orange", label: "Orange Money" }, { value: "airtel", label: "Airtel Money" }, { value: "moov", label: "Moov Money" }],
  CM: [{ value: "mtn", label: "MTN MoMo" }, { value: "orange", label: "Orange Money" }],
  CG: [{ value: "mtn", label: "MTN MoMo" }, { value: "airtel", label: "Airtel Money" }, { value: "moov", label: "Moov Money" }],
  CD: [{ value: "airtel", label: "Airtel Money" }],
  CI: [{ value: "wave", label: "Wave Money" }, { value: "mtn", label: "MTN MoMo" }, { value: "orange", label: "Orange Money" }, { value: "moov", label: "Moov Money" }],
  GA: [{ value: "airtel", label: "Airtel Money" }, { value: "moov", label: "Moov Money" }],
  KE: [{ value: "airtel", label: "Airtel Money" }],
  RW: [{ value: "mtn", label: "MTN MoMo" }, { value: "airtel", label: "Airtel Money" }],
  SN: [{ value: "wave", label: "Wave Money" }, { value: "orange", label: "Orange Money" }],
  SL: [{ value: "orange", label: "Orange Money" }, { value: "airtel", label: "Airtel Money" }],
  UG: [{ value: "mtn", label: "MTN MoMo" }, { value: "airtel", label: "Airtel Money" }],
  TZ: [{ value: "airtel", label: "Airtel Money" }, { value: "orange", label: "Orange Money" }],
  GH: [{ value: "mtn", label: "MTN MoMo" }, { value: "airtel", label: "Airtel Money" }],
  ZM: [{ value: "mtn", label: "MTN MoMo" }, { value: "airtel", label: "Airtel Money" }],
};

function getNetworksForCountry(countryCode?: string | null): { value: string; label: string }[] {
  if (!countryCode) return [];
  return COUNTRY_NETWORKS[countryCode.toUpperCase()] ?? [];
}

function getPaymentMethodLabel(gateway?: Booking["paymentGateway"], network?: string | null): string {
  if (gateway === "stripe") return "Stripe";
  if (gateway !== "tara") return "—";
  if (!network) return "Tara";
  return network.toLowerCase() === "wave" ? "Tara (Wave)" : "Tara (Mobile Money)";
}

const fetchBookings = (params: Record<string, string>) =>
  listingApi.get(`/admin/bookings?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

const fetchBookingDetail = (id: string) =>
  listingApi.get(`/admin/bookings/${id}`).then((r) => r.data.data ?? r.data);

export default function BookingsPage() {
  const qc = useQueryClient();
  const { token, user, _hasHydrated } = useAuthStore();
  const role = user?.role as AdminRole | undefined;
  
  const isAdminOrSuperAdmin = user?.role === "super_admin" || user?.role === "admin";
  const isCountryScoped = ["sales", "country_manager"].includes(user?.role || "");
  const canManualBook = canAccess(role, "manage_manual_booking");
  const canManageBookings = canAccess(role, "manage_bookings");
  const userCountries = user?.countryScope ?? [];

  // scopedCountries only applies to country_manager / sales (not admin — admin sees all)
  const scopedCountries = isCountryScoped ? userCountries : [];
  const canShowCountryFilter = user?.role === "super_admin" || user?.role === "admin" || (isCountryScoped && scopedCountries.length > 1);
  const countryOptions = scopedCountries.length > 0
    ? scopedCountries.map((c) => {
        const found = SYSTEM_COUNTRIES.find((sc) => sc.code === c);
        return { value: c, label: found ? `${found.flag} ${found.name}` : c };
      })
    : COUNTRY_OPTIONS;

  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const canViewPendingRequests = ["super_admin", "admin", "country_manager", "sales"].includes(role || "");
  const showTabs = canViewPendingRequests;

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
  const [resendGateway, setResendGateway] = useState<"stripe" | "tara">("stripe");
  const [resendNetwork, setResendNetwork] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);

  // Decline Request States
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineBooking, setDeclineBooking] = useState<any | null>(null);
  const [declineReasonType, setDeclineReasonType] = useState<string>("");
  const [declineReason, setDeclineReason] = useState("");

  // Messaging States
  const [messageText, setMessageText] = useState("");

  // Action Status States
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    setActionError(null);
    setActionSuccess(null);
  }, [selected, activeTab]);

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

  // Query: Fetch all normal bookings
  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", params],
    queryFn: () => fetchBookings(params),
    enabled: !!token && _hasHydrated && activeTab === "all",
  });

  const bookings: Booking[] = data?.bookings ?? [];
  const total: number = data?.total ?? 0;

  // EUR-converted display rates for the money columns on this page.
  const eurRates = useEurRates(bookings.map((b) => b.currency));

  // Query: Fetch pending requests (only if user has permission)
  const pendingParams = { page: String(page), limit: String(limit) };
  const { data: pendingData, isLoading: isLoadingPending } = useQuery({
    queryKey: ["admin-pending-booking-requests", pendingParams],
    queryFn: () => listingApi.get(`/admin/booking-requests/pending`, { params: pendingParams }).then(r => r.data.data ?? r.data),
    enabled: !!token && _hasHydrated && canViewPendingRequests,
  });

  const pendingRequests = pendingData?.requests ?? [];
  const pendingTotal = pendingData?.total ?? 0;

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

  // Client side filtering for pending requests list
  const filteredPendingRequests = pendingRequests.filter((b: any) => {
    if (q) {
      const search = q.toLowerCase();
      const matchRef = b.reference?.toLowerCase().includes(search);
      const matchName = `${b.guestFirstName} ${b.guestLastName}`.toLowerCase().includes(search);
      const matchListing = b.listing?.name?.toLowerCase().includes(search);
      if (!matchRef && !matchName && !matchListing) return false;
    }
    if (country && b.listing?.country !== country) return false;
    return true;
  });

  const { data: detailData, isLoading: loadingDetail } = useQuery({
    queryKey: ["admin-booking-detail", selected?.id],
    queryFn: () => fetchBookingDetail(selected!.id),
    enabled: !!selected,
  });

  // Check if current agent can act on the selected booking (country scope check)
  const canAgentAct = !isCountryScoped || userCountries.includes(detailData?.listing?.country || "");

  // Message thread queries
  const { data: convData } = useQuery({
    queryKey: ["admin-booking-conversation", selected?.id],
    queryFn: () => listingApi.get(`/admin/conversations`, { params: { q: selected?.id || "" } }).then(r => r.data.data ?? r.data),
    enabled: !!selected && activeTab === "pending",
  });

  const conversationId = convData?.conversations?.[0]?.id;

  const { data: messagesData } = useQuery({
    queryKey: ["admin-conversation-messages", conversationId],
    queryFn: () => listingApi.get(`/admin/conversations/${conversationId}/messages`).then(r => r.data.data ?? r.data),
    enabled: !!conversationId,
  });

  const messages = messagesData?.messages ?? [];

  // Mutations
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
  const resendPhoneCountry = useMemo(() => {
    if (!resendModal?.guestPhone) return "";
    try {
      const parsed = parsePhoneNumber(resendModal.guestPhone);
      return parsed?.country ?? "";
    } catch {
      return "";
    }
  }, [resendModal]);

  const resendLinkMut = useMutation({
    mutationFn: async ({ id, gateway }: { id: string; gateway: "stripe" | "tara" }) => {
      setResendError("");
      setResendSuccess(false);
      const res = await paymentApi.post(`/${gateway}/payment-link`, { bookingId: id });
      if (gateway === "tara") {
        await paymentApi.post(`/tara/trigger/${id}`, { network: resendNetwork || undefined });
      }
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

  // Approve request mutation
  const approveRequestMut = useMutation({
    mutationFn: (id: string) =>
      listingApi.post(`/admin/booking-requests/${id}/approve`).then(r => r.data),
    onSuccess: () => {
      setActionSuccess("Booking request approved successfully.");
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin-pending-booking-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-detail"] });
      setSelected(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.error?.message ?? "Approval failed.");
      setActionSuccess(null);
    }
  });

  // Decline request mutation
  const declineRequestMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      listingApi.post(`/admin/booking-requests/${id}/decline`, { reason }).then(r => r.data),
    onSuccess: () => {
      setActionSuccess("Booking request declined successfully.");
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin-pending-booking-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-detail"] });
      setSelected(null);
      setDeclineModalOpen(false);
      setDeclineBooking(null);
      setDeclineReasonType("");
      setDeclineReason("");
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.error?.message ?? "Decline failed.");
      setActionSuccess(null);
    }
  });

  // Escalate to Host mutation
  const escalateRequestMut = useMutation({
    mutationFn: (id: string) =>
      listingApi.post(`/admin/booking-requests/${id}/escalate`).then(r => r.data),
    onSuccess: () => {
      setActionSuccess("Reminder warning escalated to host.");
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin-pending-booking-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-detail"] });
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.error?.message ?? "Escalation failed.");
      setActionSuccess(null);
    }
  });

  // Request More Info (Send message) mutation
  const requestInfoMut = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      listingApi.post(`/admin/booking-requests/${id}/request-info`, { message }).then(r => r.data),
    onSuccess: () => {
      setMessageText("");
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin-booking-conversation", selected?.id] });
      if (conversationId) {
        qc.invalidateQueries({ queryKey: ["admin-conversation-messages", conversationId] });
      }
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.error?.message ?? "Failed to send message.");
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
          <p className="font-semibold text-sm tabular"><EurValue amount={b.totalAmount} currency={b.currency} rates={eurRates} /></p>
          <p className="text-xs text-slate-500">Commission: <EurValue amount={b.commissionAmount} currency={b.currency} rates={eurRates} /></p>
          <p className="text-xs text-emerald-600">Payout: <EurValue amount={b.providerPayout} currency={b.currency} rates={eurRates} /></p>
        </div>
      ),
    },
    {
      key: "payment",
      label: "Payment Method",
      render: (b) => <span className="text-sm text-slate-700">{getPaymentMethodLabel(b.paymentGateway, b.paymentNetwork)}</span>,
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
          {["pending_payment", "confirmed"].includes(b.status) && (b.status === "pending_payment" || canManageBookings) && (
            <button
              onClick={() => setCancelModal(b)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
              title="Cancel booking"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
          {b.status === "draft" && (
            <button
              onClick={() => setResendModal(b)}
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

  // Tailored columns for Pending Requests list
  const pendingColumns: Column<any>[] = [
    {
      key: "ref",
      label: "Reference",
      width: "160px",
      render: (b) => (
        <div>
          <p className="font-mono font-medium text-sm text-primary">{b.reference}</p>
          <span className="text-[10px] font-semibold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
            Request to Book
          </span>
        </div>
      ),
    },
    {
      key: "guest",
      label: "Guest",
      render: (b) => (
        <p className="font-medium text-sm text-slate-900">{b.guestFirstName} {b.guestLastName}</p>
      ),
    },
    {
      key: "listing",
      label: "Listing",
      render: (b) => (
        <div>
          <p className="text-sm text-slate-700 truncate">{b.listing?.name ?? b.listingId}</p>
          {b.listing?.country && <p className="text-[10px] text-slate-400">Country: {b.listing.country}</p>}
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (b) => (
        <p className="font-semibold text-sm tabular text-right"><EurValue amount={b.totalAmount} currency={b.currency} rates={eurRates} /></p>
      ),
    },
    {
      key: "created",
      label: "Waiting Time",
      render: (b) => {
        const hours = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60));
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">{formatRelativeTime(b.createdAt)}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 w-fit">
              <Clock className="h-3 w-3" /> Waiting {hours}h
            </span>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: "160px",
      render: (b) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none focus:ring-emerald-500/30"
            loading={approveRequestMut.isPending && selected?.id === b.id}
            onClick={() => approveRequestMut.mutate(b.id)}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setDeclineBooking(b);
              setDeclineReasonType("");
              setDeclineReason("");
              setDeclineModalOpen(true);
            }}
          >
            Decline
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-2xl">
      <SectionHeader
        title="Bookings"
        description={`${activeTab === "pending" ? pendingTotal.toLocaleString() : total.toLocaleString()} total bookings`}
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

      {showTabs && (
        <div className="flex border-b border-border bg-white rounded-t-xl px-4 pt-3 gap-2 overflow-x-auto">
          {[
            { key: "all", label: "All Bookings", count: total, color: "text-slate-500" },
            { key: "pending", label: "Pending Requests", count: pendingTotal, color: "text-amber-500" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key as any);
                  setPage(1);
                }}
                className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all leading-none ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Card padding="none" className={showTabs ? "rounded-t-none border-t-0" : ""}>
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search reference, email…"
          filters={activeTab === "all" ? [
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
          ] : [
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
          {activeTab === "all" && canShowCountryFilter && (
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
          columns={activeTab === "pending" ? pendingColumns : columns}
          data={activeTab === "pending" ? filteredPendingRequests : filteredBookings}
          loading={activeTab === "pending" ? isLoadingPending : isLoading}
          onRowClick={(b) => setSelected(b)}
          emptyTitle={activeTab === "pending" ? "No pending requests found" : "No bookings found"}
          emptyDescription={activeTab === "pending" ? "There are no request-to-book bookings waiting for approval." : "Try adjusting your search or filters."}
          emptyIcon={activeTab === "pending" ? <Clock className="h-10 w-10 text-slate-300" /> : <CalendarDays className="h-10 w-10" />}
        />
        
        <Pagination
          page={page}
          limit={limit}
          total={activeTab === "pending" ? pendingTotal : total}
          onPageChange={setPage}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
      </Card>

      {/* Detail drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Booking ${selected?.reference}`}
        description={`${selected?.guestFirstName} ${selected?.guestLastName} · ${selected?.guestEmail}`}
        width="md"
        footer={
          selected && ["pending_payment", "confirmed"].includes(selected.status) && activeTab !== "pending" && (selected.status === "pending_payment" || canManageBookings) ? (
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
            
            {/* Status alerts for Manual Booking Request actions */}
            {actionError && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}
            {actionSuccess && (
              <div className="p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Unresponsive Host Action Center (Request-to-book only) */}
            {activeTab === "pending" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 shadow-sm">
                {!canAgentAct ? (
                  <div className="flex gap-2.5">
                    <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-rose-800">Outside Assigned Country Scope</h4>
                      <p className="text-xs text-rose-700 mt-0.5">
                        This booking is located in <strong className="uppercase">{detailData.listing?.country}</strong>, which is outside your assigned country scope ({userCountries.join(", ")}). You are not authorized to act on this request.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2.5">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-800">Unresponsive Host Action Center</h4>
                        <p className="text-xs text-amber-700 mt-0.5">
                          This Request-to-Book booking has been pending host approval for over 2 hours. As an authorized administrator or agent, you can act on the host's behalf.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        variant="primary"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-none focus:ring-emerald-500/30"
                        size="sm"
                        loading={approveRequestMut.isPending}
                        onClick={() => approveRequestMut.mutate(detailData.id)}
                      >
                        Approve Request
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeclineBooking(detailData);
                          setDeclineReasonType("");
                          setDeclineReason("");
                          setDeclineModalOpen(true);
                        }}
                      >
                        Decline Request
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={escalateRequestMut.isPending}
                        onClick={() => escalateRequestMut.mutate(detailData.id)}
                      >
                        Escalate to Host
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const msgElement = document.getElementById("messaging-section");
                          if (msgElement) {
                            msgElement.scrollIntoView({ behavior: "smooth" });
                          }
                        }}
                      >
                        Request Info
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Reference", detailData.reference],
                ["Status", ""],
                ["Type", detailData.listingType],
                ["Payment Method", getPaymentMethodLabel(detailData.paymentGateway, detailData.paymentNetwork)],
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
              {[["Subtotal", <EurValue key="s" amount={detailData.subtotal} currency={detailData.currency} rates={eurRates} />],
                ["Voucher Discount", <span key="v" className="text-danger">- <EurValue amount={detailData.voucherDiscount} currency={detailData.currency} rates={eurRates} /></span>],
                ["Service Fee", <EurValue key="f" amount={detailData.serviceFee} currency={detailData.currency} rates={eurRates} />],
                ["Delivery Fee", <EurValue key="d" amount={detailData.deliveryFee} currency={detailData.currency} rates={eurRates} />],
                 ["Total", <EurValue key="T" amount={detailData.totalAmount} currency={detailData.currency} rates={eurRates} />],
                 ["Refund Due", <EurValue key="r" amount={detailData.refundAmount ?? 0} currency={detailData.currency} rates={eurRates} />],
                 ["Cancellation Policy", detailData.cancellationPolicy ?? "-"],
                 ["Commission", <EurValue key="c" amount={detailData.commissionAmount} currency={detailData.currency} rates={eurRates} />],
                ["Provider Payout", <EurValue key="p" amount={detailData.providerPayout} currency={detailData.currency} rates={eurRates} />],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between">
                  <span className={k === "Total" ? "font-semibold text-slate-900" : "text-slate-500"}>{k}</span>
                  <span className={k === "Total" ? "font-bold text-slate-900 tabular" : "tabular text-slate-700"}>{v}</span>
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

            {/* Guest Messaging (Request More Info thread) */}
            {activeTab === "pending" && (
              <div id="messaging-section" className="border-t border-border pt-5 space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Guest Messaging (Request More Info)</h4>
                
                {/* Scrollable messages container */}
                <div className="bg-slate-50 border border-border rounded-xl p-4 max-h-60 overflow-y-auto space-y-3 scrollbar-thin">
                  {messages.map((msg: any) => {
                    const isOutbound = msg.senderType === "admin";
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isOutbound ? "flex-row-reverse" : ""}`}>
                        <Avatar
                          name={isOutbound ? "Admin" : msg.senderType === "guest" ? "Guest" : "Provider"}
                          size="sm"
                          className={isOutbound ? "bg-primary" : msg.senderType === "guest" ? "bg-blue-500" : "bg-emerald-500"}
                        />
                        <div className={`max-w-[75%] ${isOutbound ? "items-end flex flex-col" : ""}`}>
                          <div
                            className={`px-3 py-2 rounded-xl text-sm ${
                              isOutbound
                                ? "bg-primary text-white"
                                : "bg-white border border-border text-slate-800"
                            } ${msg.isFiltered ? "opacity-50 italic" : ""}`}
                          >
                            {msg.body}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400">
                            <span>{isOutbound ? "Agent" : msg.senderType === "guest" ? "Guest" : "Provider"}</span>
                            <span>·</span>
                            <span>{formatRelativeTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-4">
                      No conversation started yet. Type a message below to request more details from the guest.
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Textarea
                    id="request-info-message"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={canAgentAct ? "Type message to guest..." : "Messaging disabled (outside country scope)"}
                    rows={2}
                    disabled={!canAgentAct}
                    className="flex-1 min-h-[50px] resize-none py-1.5 px-3 text-sm"
                  />
                  <Button
                    variant="primary"
                    disabled={!messageText.trim() || !canAgentAct}
                    loading={requestInfoMut.isPending}
                    onClick={() => requestInfoMut.mutate({ id: detailData.id, message: messageText })}
                    className="self-end"
                  >
                    Send
                  </Button>
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

      {/* Decline Booking Request Modal */}
      <ActionModal
        open={declineModalOpen}
        onClose={() => {
          setDeclineModalOpen(false);
          setDeclineBooking(null);
          setDeclineReasonType("");
          setDeclineReason("");
        }}
        title="Decline Booking Request"
        description={`Decline booking request ${declineBooking?.reference}? The date locks will be released.`}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeclineModalOpen(false)}
              disabled={declineRequestMut.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={declineRequestMut.isPending}
              disabled={!declineReasonType || (declineReasonType === "Other" && !declineReason.trim())}
              onClick={() => {
                const finalReason = declineReasonType === "Other" ? declineReason : declineReasonType;
                declineBooking && declineRequestMut.mutate({ id: declineBooking.id, reason: finalReason });
              }}
            >
              Confirm Decline
            </Button>
          </>
        }
      >
        <div className="space-y-4 pt-2">
          {actionError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Decline Reason</label>
            <select
              value={declineReasonType}
              onChange={(e) => setDeclineReasonType(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">Select a reason...</option>
              <option value="Unavailable dates">Unavailable dates</option>
              <option value="Property under maintenance">Property under maintenance</option>
              <option value="Guest requirements not met">Guest requirements not met</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {declineReasonType === "Other" && (
            <Textarea
              id="decline-custom-reason"
              label="Describe reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Explain why this request is being declined..."
              required
              rows={3}
            />
          )}
        </div>
      </ActionModal>

      {/* Resend payment link modal */}
      <ActionModal
        open={!!resendModal}
        onClose={() => {
          setResendModal(null);
          setResendError("");
          setResendSuccess(false);
          setResendNetwork("");
        }}
        title="Send/Resend Payment Link"
        description={
          resendSuccess
            ? "Payment link has been successfully generated and sent to the guest."
            : `Generate and email a secure payment link for booking ${resendModal?.reference}.`
        }
        size="sm"
        footer={
          resendSuccess ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setResendModal(null);
                setResendSuccess(false);
              }}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setResendModal(null)}
                disabled={resendLinkMut.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={resendLinkMut.isPending}
                onClick={() => resendModal && resendLinkMut.mutate({ id: resendModal.id, gateway: resendGateway })}
                leftIcon={<Send className="h-4 w-4" />}
              >
                Send Link
              </Button>
            </>
          )
        }
      >
        {!resendSuccess && (
          <div className="space-y-4 pt-2">
            {resendError && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg">
                {resendError}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Guest Email</label>
              <input
                type="text"
                disabled
                value={resendModal?.guestEmail ?? ""}
                className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Select Payment Gateway</p>
              <div className="grid grid-cols-2 gap-3">
                {(["stripe", "tara"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setResendGateway(m)}
                    className={`flex items-center gap-2.5 rounded-xl border-2 px-4 py-2.5 transition-all text-left ${
                      resendGateway === m
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      resendGateway === m ? "border-primary" : "border-slate-300"
                    }`}>
                      {resendGateway === m && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-xs font-semibold capitalize">{m === "tara" ? "Tara" : "Stripe"}</span>
                  </button>
                ))}
              </div>
            </div>

            {resendGateway === "tara" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Network</label>
                <select
                  value={resendNetwork}
                  onChange={(e) => setResendNetwork(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                >
                  <option value="">Select Network</option>
                  {getNetworksForCountry(resendPhoneCountry).map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {resendSuccess && (
          <div className="py-4 text-center">
            <div className="mx-auto w-12 h-12 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Email Sent Successfully</p>
            <p className="text-xs text-slate-500 mt-1">The guest has been sent the link for {resendGateway === "stripe" ? "Stripe" : "Tara"} payment.</p>
          </div>
        )}
      </ActionModal>
    </div>
  );
}
