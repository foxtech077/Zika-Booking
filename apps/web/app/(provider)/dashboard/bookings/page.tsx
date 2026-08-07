"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient, useQueries, keepPreviousData } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
    BookOpen, Calendar, Search, X, CheckCircle, XCircle, Clock,
    DollarSign, User, Eye, Check, Ban, AlertCircle, ChevronLeft,
    ChevronRight, ChevronDown, Phone, Mail, CreditCard, FileText, Calendar as CalendarIcon,
    TrendingUp, TrendingDown, MoreVertical
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { cn } from "@/lib/utils";
import type { ProviderBooking } from "@/types/provider";

// Types
type Booking = ProviderBooking & {
    paymentStatus: string;
    transactionId?: string;
    displayId?: string;
    paymentMethod?: string;
    guestCount?: number;
    notes?: string;
};

type BookingAction = "approve" | "cancel";

type ActionFeedback = {
    type: BookingAction;
    message: string;
};

type SelectOption = {
    value: string;
    label: string;
};

// Status Config
const bookingStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "#eab308" },
    pending_payment: { label: "Pending", color: "#eab308" },
    confirmed: { label: "Confirmed", color: "#22c55e" },
    cancelled: { label: "Cancelled", color: "#ef4444" },
    cancelled_by_guest: { label: "Cancelled by Guest", color: "#ef4444" },
    cancelled_by_provider: { label: "Cancelled by Provider", color: "#ef4444" },
    cancelled_by_system: { label: "Cancelled by System", color: "#ef4444" },
    completed: { label: "Completed", color: "#3b82f6" },
    failed: { label: "Failed", color: "#f97316" },
};

const cancellationStatusValues = [
    "cancelled_by_guest",
    "cancelled_by_provider",
    "cancelled_by_system",
];

function isCancellationStatusFilter(statusFilter: string) {
    return statusFilter === "cancelled" || cancellationStatusValues.includes(statusFilter);
}

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
    paid: { label: "Paid", color: "#22c55e" },
    pending: { label: "Pending", color: "#eab308" },
    failed: { label: "Failed", color: "#ef4444" },
    refunded: { label: "Refunded", color: "#6b7280" },
};

const bookingStatusOptions: SelectOption[] = [
    { value: "", label: "All Status" },
    { value: "pending_payment", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "cancelled_by_guest", label: "Cancelled by Guest" },
    { value: "cancelled_by_provider", label: "Cancelled by Provider" },
    { value: "cancelled_by_system", label: "Cancelled by System" },
];

const paymentStatusOptions: SelectOption[] = [
    { value: "", label: "All Payment" },
    { value: "paid", label: "Paid" },
    { value: "pending", label: "Pending" },
    { value: "failed", label: "Failed" },
];

const dateFilterOptions: SelectOption[] = [
    { value: "", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom Range" },
];

// Helper Functions
const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

const formatGuestName = (fullName?: string) => {
    if (!fullName) return "Guest";
    const name = fullName.trim();
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first} ${(last ?? "").charAt(0)}.`;
};

const NetCurrency = ({ amount, currency = "USD", className }: { amount: number; currency?: string; className?: string }) => {
    const formatted = formatCurrency(amount, currency);
    const tooltipText = "Your earnings after Kainook's commission has been deducted.";
    return (
        <span
            className={cn("inline-flex items-center gap-1 group relative cursor-help font-semibold", className)}
            title={tooltipText}
        >
            <span>{formatted}</span>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 scale-0 rounded-lg bg-slate-950 px-2 py-1.5 text-center text-[11px] font-normal text-white shadow-xl transition-all group-hover:scale-100 origin-bottom">
                {tooltipText}
                <span className="absolute top-full left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-0.5 rotate-45 bg-slate-950" />
            </span>
        </span>
    );
};

const formatDate = (date?: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const formatDateTime = (date?: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

function toDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
}

function inferPaymentStatus(status: string) {
    if (status === "confirmed" || status === "completed") return "paid";
    if (status.includes("cancelled")) return "refunded";
    if (status === "failed") return "failed";
    return "pending";
}

function normalizeBooking(booking: ProviderBooking): Booking {
    return {
        ...booking,
        paymentStatus: inferPaymentStatus(booking.status),
        guestCount: (booking.adults ?? 0) + (booking.children ?? 0),
    };
}

async function fetchProviderBookings(params: Record<string, string>) {
    const response = await listingApi.get(`/provider/bookings?${new URLSearchParams(params)}`);
    const data = response.data.data ?? response.data;
    const bookings = (data.bookings ?? []).map(normalizeBooking);
    return {
        bookings,
        total: Number(data.total ?? bookings.length),
    };
}

async function fetchAllProviderBookings(params: Record<string, string>) {
    const limit = 50;
    const firstPage = await fetchProviderBookings({ ...params, offset: "0", limit: String(limit) });
    const bookings = [...firstPage.bookings];

    for (let offset = limit; offset < firstPage.total; offset += limit) {
        const page = await fetchProviderBookings({ ...params, offset: String(offset), limit: String(limit) });
        bookings.push(...page.bookings);
    }

    return bookings;
}

async function fetchProviderBookingsByStatusFilter(params: Record<string, string>, statusFilter: string) {
    if (!isCancellationStatusFilter(statusFilter)) {
        return fetchProviderBookings(statusFilter ? { ...params, status: statusFilter } : params);
    }

    const offset = Math.max(0, Number(params.offset ?? "0"));
    const limit = Math.max(1, Number(params.limit ?? "20"));
    const baseParams: Record<string, string> = { ...params };
    delete baseParams.status;
    delete baseParams.offset;
    delete baseParams.limit;

    const cancellationStatuses = statusFilter === "cancelled" ? cancellationStatusValues : [statusFilter];
    const bookings = (await fetchAllProviderBookings(baseParams))
        .filter((booking) => cancellationStatuses.includes(booking.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
        bookings: bookings.slice(offset, offset + limit),
        total: bookings.length,
    };
}

function bookingLoadErrorMessage(err: any) {
    if (err.response?.status === 401) return "Session expired. Please log in again.";
    return "Unable to load bookings. Please try again.";
}

// Status Badge Component
const StatusBadge = ({ status, type = "booking" }: { status: string; type?: "booking" | "payment" }) => {
    const config = type === "payment" ? paymentStatusConfig : bookingStatusConfig;
    const statusConfig = config[status] || { label: status, color: "#6b7280" };

    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
                backgroundColor: `${statusConfig.color}15`,
                color: statusConfig.color,
                border: `1px solid ${statusConfig.color}30`
            }}
        >
            {statusConfig.label}
        </span>
    );
};

// Summary Card
const SummaryCard = ({ title, value, icon: Icon, trend }: any) => (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-lg transition-shadow duration-200 min-h-[124px]">
        <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.28em]">{title}</span>
            <div className="rounded-xl flex h-10 w-10 items-center justify-center  bg-green-700">
                <Icon className="w-5 h-5 text-white " />
            </div>
        </div>
        <div className="flex items-end justify-between gap-3">
            <span className="text-3xl font-semibold text-slate-900">{value}</span>
            {trend && (
                <span className={`text-xs font-semibold inline-flex items-center gap-1 ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {Math.abs(trend)}%
                </span>
            )}
        </div>
    </div>
);
// Loading Skeleton
const LoadingSkeleton = () => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                    <div className="h-7 bg-gray-200 rounded w-12"></div>
                </div>
            ))}
        </div>
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
                ))}
            </div>
        </div>
    </div>
);

// Mobile Booking Card
const MobileBookingCard = ({ booking, onViewDetails }: any) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-500">{booking.reference}</span>
            <StatusBadge status={booking.status} />
        </div>

        <div>
            <div className="flex items-center gap-2 mb-1">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                    {booking.guestName ?? "Guest"}
                </span>
            </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
                <span className="text-xs text-gray-500">Net Payout</span>
                <div className="text-sm font-semibold text-gray-900">
                    <NetCurrency amount={booking.providerPayout || booking.totalAmount * 0.95} currency={booking.currency} />
                </div>
            </div>
            <button
                onClick={() => onViewDetails(booking)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
                View
            </button>
        </div>
    </div>
);

const CustomSelect = ({
    value,
    options,
    onChange,
    ariaLabel,
}: {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    ariaLabel: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const selectedOption = options.find((option) => option.value === value) ?? options[0];

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return (
        <div ref={containerRef} className="relative w-full">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((open) => !open)}
                className="flex h-12 w-full items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-green-100"
            >
                <span className="truncate">{selectedOption?.label}</span>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] rounded-[14px] border border-slate-200 bg-white shadow-xl"
                        initial={{ opacity: 0, scale: 0.98, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -4 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                    >
                        <div role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto p-1.5">
                            {options.map((option) => {
                                const isSelected = option.value === value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${isSelected
                                                ? "bg-green-50 text-green-700"
                                                : "text-slate-700 hover:bg-slate-50"
                                            }`}
                                    >
                                        <span className="font-medium">{option.label}</span>
                                        {isSelected && <Check className="h-4 w-4 text-green-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const focusableSelector = [
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

const ConfirmationDialog = ({
    action,
    isPending,
    cancelReason,
    onCancelReasonChange,
    onClose,
    onConfirm,
}: {
    action: BookingAction;
    isPending: boolean;
    cancelReason?: string;
    onCancelReasonChange?: (value: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}) => {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const isCancel = action === "cancel";
    const title = isCancel ? "Cancel Booking" : "Approve Booking";
    const message = isCancel
        ? "Are you sure you want to cancel this booking?"
        : "Are you sure you want to approve this booking?";

    useEffect(() => {
        const previousActiveElement = document.activeElement as HTMLElement | null;
        const dialog = dialogRef.current;
        const firstFocusable = dialog?.querySelector<HTMLElement>(focusableSelector);
        firstFocusable?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== "Tab" || !dialog) return;

            const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0]!;
            const lastElement = focusableElements[focusableElements.length - 1]!;

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previousActiveElement?.focus();
        };
    }, [onClose]);

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            aria-hidden={false}
        >
            <motion.div
                className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="booking-action-title"
                aria-describedby="booking-action-message"
                className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none"
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="px-6 pt-6">
                    <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full ${isCancel ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"}`}>
                        {isCancel ? <Ban className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                    </div>
                    <h2 id="booking-action-title" className="text-lg font-semibold text-slate-950">
                        {title}
                    </h2>
                    <p id="booking-action-message" className="mt-2 text-sm leading-6 text-slate-600">
                        {message}
                    </p>
                </div>

                {isCancel && (
                    <div className="px-6 pt-5">
                        <label htmlFor="cancel-reason" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Cancellation reason
                        </label>
                        <textarea
                            id="cancel-reason"
                            value={cancelReason}
                            onChange={(event) => onCancelReasonChange?.(event.target.value)}
                            placeholder="Enter cancellation reason..."
                            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                            rows={4}
                        />
                    </div>
                )}

                <div className="flex items-center justify-end gap-3 px-6 py-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
                    >
                        {isCancel ? "Keep Booking" : "Cancel"}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isPending || (isCancel && !cancelReason?.trim())}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${isCancel
                                ? "bg-amber-700 hover:bg-amber-800 focus:ring-amber-100"
                                : "bg-slate-950 hover:bg-slate-800 focus:ring-slate-200"
                            }`}
                    >
                        {isPending ? (isCancel ? "Cancelling..." : "Approving...") : isCancel ? "Cancel Booking" : "Yes, Approve"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const ActionFeedbackCard = ({ feedback }: { feedback: ActionFeedback }) => {
    const isCancel = feedback.type === "cancel";

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            <motion.div
                className="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-2xl"
                initial={{ opacity: 0, scale: 0.94, y: isCancel ? 10 : 0 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -4 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
                <motion.div
                    className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isCancel ? "border border-amber-200 bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
                        }`}
                    initial={{ scale: 0.72 }}
                    animate={{ scale: [0.72, 1.08, 1] }}
                    transition={{ duration: 0.42, ease: "easeOut" }}
                >
                    {isCancel ? <Ban className="h-7 w-7" /> : <CheckCircle className="h-7 w-7" />}
                </motion.div>
                <p className="text-base font-semibold text-slate-950">{feedback.message}</p>
            </motion.div>
        </motion.div>
    );
};

export default function BookingsPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [bookingStatus, setBookingStatus] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");
    const [offset, setOffset] = useState(0);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [pendingAction, setPendingAction] = useState<{ type: BookingAction; bookingId: string } | null>(null);
    const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
    const [cancelReason, setCancelReason] = useState("");

    const limit = 10;

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(searchInput);
            setOffset(0);
        }, 300);

        return () => window.clearTimeout(timer);
    }, [searchInput]);

    // Build stable queryKey using array instead of object to prevent unnecessary refetches
    const queryKeyArray = [
        "provider-bookings",
        offset,
        limit,
        search || "",
        bookingStatus || "",
    ];

    const requestParams: Record<string, string> = {
        offset: String(offset),
        limit: String(limit),
    };
    if (search) requestParams.search = search;

    let filterStartDate = "";
    let filterEndDate = "";
    if (dateFilter === 'today') {
        const today = toDateOnly(new Date());
        filterStartDate = today;
        filterEndDate = today;
    } else if (dateFilter === 'week') {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        filterStartDate = toDateOnly(start);
        filterEndDate = toDateOnly(end);
    } else if (dateFilter === 'month') {
        const end = new Date();
        const start = new Date();
        start.setMonth(end.getMonth() - 1);
        filterStartDate = toDateOnly(start);
        filterEndDate = toDateOnly(end);
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        filterStartDate = customStartDate;
        filterEndDate = customEndDate;
    }

    const { data, isLoading, isFetching, refetch } = useQuery<{ bookings: Booking[]; total: number }, Error>({
        queryKey: queryKeyArray,
        queryFn: async () => {
            setError(null);

            try {
                return await fetchProviderBookingsByStatusFilter(requestParams, bookingStatus);
            } catch (err: any) {
                if (isCancellationStatusFilter(bookingStatus) && err.response?.status === 400) {
                    return { bookings: [], total: 0 };
                }

                setError(bookingLoadErrorMessage(err));
                throw err;
            }
        },
        retry: false,
        staleTime: 5000,
        placeholderData: keepPreviousData,
    });

    const summaryQueries = useQueries({
        queries: [
            {
                queryKey: ["provider-bookings-summary", "all"],
                queryFn: async () => {
                    const result = await fetchProviderBookings({ offset: "0", limit: "1" });
                    return result.total;
                },
                staleTime: 60000,
                retry: false,
            },
            {
                queryKey: ["provider-bookings-summary", "pending_payment"],
                queryFn: async () => {
                    const result = await fetchProviderBookings({ offset: "0", limit: "1", status: "pending_payment" });
                    return result.total;
                },
                staleTime: 60000,
                retry: false,
            },
            {
                queryKey: ["provider-bookings-summary", "confirmed"],
                queryFn: async () => {
                    const result = await fetchProviderBookings({ offset: "0", limit: "1", status: "confirmed" });
                    return result.total;
                },
                staleTime: 60000,
                retry: false,
            },
            {
                queryKey: ["provider-bookings-summary", "cancelled"],
                queryFn: async () => {
                    const result = await fetchProviderBookingsByStatusFilter({ offset: "0", limit: "1" }, "cancelled");
                    return result.total;
                },
                staleTime: 60000,
                retry: false,
            },
            {
                queryKey: ["provider-bookings-summary", "completed"],
                queryFn: async () => {
                    const result = await fetchProviderBookings({ offset: "0", limit: "1", status: "completed" });
                    return result.total;
                },
                staleTime: 60000,
                retry: false,
            },
        ],
    });

    const summaryStats = {
        total: summaryQueries[0]?.data ?? 0,
        pending: summaryQueries[1]?.data ?? 0,
        confirmed: summaryQueries[2]?.data ?? 0,
        cancelled: summaryQueries[3]?.data ?? 0,
        completed: summaryQueries[4]?.data ?? 0,
    };

    const allBookings: Booking[] = data?.bookings || [];
    const filteredBookings = allBookings.filter((booking) => {
        if (bookingStatus === "cancelled" && !booking.status.includes("cancelled")) return false;
        if (paymentStatus && booking.paymentStatus !== paymentStatus) return false;

        const bookingDate = (booking.checkIn || booking.pickupDatetime || booking.createdAt).slice(0, 10);
        if (filterStartDate && bookingDate < filterStartDate) return false;
        if (filterEndDate && bookingDate > filterEndDate) return false;
        return true;
    });

    const hasClientSideFilters = Boolean(paymentStatus || dateFilter);
    const displayBookings = hasClientSideFilters ? filteredBookings.slice(offset, offset + limit) : allBookings;
    const totalDisplay = hasClientSideFilters ? filteredBookings.length : data?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalDisplay / limit));
    const currentPage = Math.min(Math.max(1, Math.floor(offset / limit) + 1), totalPages);
    const displayStart = totalDisplay === 0 ? 0 : offset + 1;
    const displayEnd = hasClientSideFilters ? Math.min(offset + displayBookings.length, totalDisplay) : Math.min(offset + allBookings.length, totalDisplay);

    useEffect(() => {
        if (offset > 0 && offset >= totalDisplay) {
            setOffset(0);
        }
    }, [offset, totalDisplay]);

    // Mutations
    const confirmMutation = useMutation({
        mutationFn: async (bookingId: string) => {
            const response = await listingApi.patch(`/bookings/${bookingId}/confirm`, {});
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["provider-bookings"] });
            setActionFeedback({ type: "approve", message: "Booking Approved" });
            setTimeout(() => setActionFeedback(null), 1800);
        },
        onError: (err: any) => {
            const message = err.response?.data?.message || err.message || "Failed to confirm booking";
            setNotification({ type: "error", message });
            setTimeout(() => setNotification(null), 4000);
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
            const response = await listingApi.post(`/provider/bookings/${bookingId}/cancel`, { reasonCode: "provider_cancelled", reasonText: reason });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["provider-bookings"] });
            setActionFeedback({ type: "cancel", message: "Booking Cancelled" });
            setTimeout(() => setActionFeedback(null), 1800);
        },
        onError: (err: any) => {
            const message = err.response?.data?.message || err.response?.data?.error?.message || err.message || "Failed to cancel booking";
            setNotification({ type: "error", message });
            setTimeout(() => setNotification(null), 4000);
        },
    });

    // Handlers
    const handleConfirm = (bookingId: string) => {
        setPendingAction({ type: "approve", bookingId });
    };

    const handleCancelOpen = (bookingId: string) => {
        setCancelReason("");
        setPendingAction({ type: "cancel", bookingId });
    };

    const closePendingAction = useCallback(() => {
        setPendingAction(null);
        setCancelReason("");
    }, []);

    const handleActionConfirm = useCallback(() => {
        if (!pendingAction) return;

        if (pendingAction.type === "approve") {
            confirmMutation.mutate(pendingAction.bookingId);
            setPendingAction(null);
            return;
        }

        if (!cancelReason.trim()) return;
        cancelMutation.mutate({ bookingId: pendingAction.bookingId, reason: cancelReason });
        closePendingAction();
    }, [cancelMutation, cancelReason, closePendingAction, confirmMutation, pendingAction]);

    const handleViewDetails = (booking: Booking) => {
        setSelectedBooking(booking);
        setIsDrawerOpen(true);
    };

    const clearFilters = () => {
        setSearch("");
        setSearchInput("");
        setBookingStatus("");
        setPaymentStatus("");
        setDateFilter("");
        setCustomStartDate("");
        setCustomEndDate("");
        setOffset(0);
    };

    // Helper function to generate empty state message based on active filters
    const getEmptyStateMessage = () => {
        if (search) {
            return {
                title: "No bookings match your search",
                description: `No bookings found for "${search}"`,
            };
        }
        if (bookingStatus) {
            const statusLabel = bookingStatusConfig[bookingStatus]?.label || bookingStatus;
            return {
                title: `No ${statusLabel} bookings`,
                description: `You don't have any bookings with status: ${statusLabel}`,
            };
        }
        if (paymentStatus) {
            const paymentLabelMap: Record<string, string> = {
                paid: "Paid",
                pending: "Pending",
                failed: "Failed",
                refunded: "Refunded",
            };
            const paymentLabel = paymentLabelMap[paymentStatus] || paymentStatus;
            return {
                title: `No ${paymentLabel} payments`,
                description: `No bookings found with payment status: ${paymentLabel}`,
            };
        }
        if (dateFilter) {
            if (dateFilter === 'custom' && customStartDate && customEndDate) {
                return {
                    title: "No bookings found for this date range",
                    description: `No bookings were found from ${formatDate(customStartDate)} to ${formatDate(customEndDate)}.`,
                };
            }
            const periodLabel = dateFilter === 'today' ? 'today' : dateFilter === 'week' ? 'this week' : 'this month';
            return {
                title: "No bookings found for the selected date range",
                description: `No bookings were found ${periodLabel}.`,
            };
        }
        return {
            title: "No bookings available",
            description: "No bookings match your filters or have been created yet.",
        };
    };

    const emptyStateMessage = getEmptyStateMessage();

    const filterContextMessage = (() => {
        if (search) {
            return `Search results for "${search}" (${data?.total ?? displayBookings.length})`;
        }
        if (bookingStatus) {
            const label = bookingStatusConfig[bookingStatus]?.label || bookingStatus;
            return `Showing ${label} bookings (${data?.total ?? displayBookings.length})`;
        }
        if (paymentStatus) {
            const label = paymentStatusConfig[paymentStatus]?.label || paymentStatus;
            return `Payment status: ${label}`;
        }
        if (dateFilter) {
            if (dateFilter === 'custom' && customStartDate && customEndDate) {
                return `Date range: ${formatDate(customStartDate)} – ${formatDate(customEndDate)}`;
            }
            if (dateFilter === 'today') return "Date range: Today";
            if (dateFilter === 'week') return "Date range: Last 7 days";
            if (dateFilter === 'month') return "Date range: Last 30 days";
        }
        return "";
    })();

    const showFilterContext = Boolean(filterContextMessage);

    // Render Action Buttons
    const renderActions = (booking: Booking) => {
        const status = String(booking.status);

        if (status === 'pending' || status === 'pending_payment') {
            return (
                <div className="flex gap-1.5">
                    <button
                        onClick={() => handleConfirm(booking.id)}
                        disabled={confirmMutation.isPending}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                        title="Confirm"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleCancelOpen(booking.id)}
                        disabled={cancelMutation.isPending}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        title="Cancel"
                    >
                        <Ban className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleViewDetails(booking)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        title="Details"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>
            );
        }

        if (status === 'confirmed') {
            return (
                <div className="flex gap-1.5">
                    <button
                        onClick={() => handleCancelOpen(booking.id)}
                        disabled={cancelMutation.isPending}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        title="Cancel"
                    >
                        <Ban className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleViewDetails(booking)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        title="Details"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>
            );
        }

        return (
            <button
                onClick={() => handleViewDetails(booking)}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Details"
            >
                <Eye className="w-4 h-4" />
            </button>
        );
    };

    const bookingGridClass = "grid gap-3 lg:grid-cols-[1.05fr_1.1fr_1.25fr_0.9fr_0.85fr_0.8fr_0.9fr_0.7fr]";

    const renderBookingField = (
        label: string,
        content: ReactNode,
        className: string = ""
    ) => (
        <div className={`min-w-0 ${className}`}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                {label}
            </div>
            {content}
        </div>
    );

    const renderBookingRow = (booking: Booking) => (
        <div
            key={booking.id}
            className={`${bookingGridClass} rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] lg:items-center`}
        >
            {renderBookingField(
                "Booking ID",
                <>
                    <span className="block truncate font-mono text-xs font-semibold text-slate-950">{booking.reference}</span>
                    <span className="mt-1 block text-xs text-slate-400">{formatDate(booking.createdAt)}</span>
                </>
            )}
            {renderBookingField(
                "Customer",
                <>
                    <div className="truncate text-sm font-semibold text-slate-950">
                        {booking.guestName ?? "Guest"}
                    </div>
                </>
            )}
            {renderBookingField(
                "Service",
                <div className="truncate text-sm font-medium text-slate-700">{booking.listingTitle || "—"}</div>
            )}
            {renderBookingField(
                "Date",
                <div className="text-sm font-medium text-slate-700">{formatDate(booking.checkIn || booking.pickupDatetime)}</div>
            )}
            {renderBookingField(
                "Amount",
                <div className="text-sm font-semibold text-slate-950">
                    <NetCurrency amount={booking.providerPayout || booking.totalAmount * 0.95} currency={booking.currency} />
                </div>
            )}
            {renderBookingField(
                "Payment",
                <StatusBadge status={booking.paymentStatus || 'pending'} type="payment" />
            )}
            {renderBookingField(
                "Status",
                <StatusBadge status={booking.status} />
            )}
            {renderBookingField(
                "Actions",
                <div className="flex justify-start lg:justify-end">{renderActions(booking)}</div>
            )}
        </div>
    );

    if (isLoading && !data) return <LoadingSkeleton />;

    return (
        <div className="p-4 md:p-5">
            {/* Header */}
            <div className="mb-5">
                <h1 className="text-xl font-semibold text-gray-900">Bookings</h1>
                <p className="text-xs text-gray-500 mt-0.5">Manage and monitor all customer bookings</p>
            </div>

            {isFetching && !isLoading && (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-slate-700 animate-pulse" />
                    Updating results
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                <SummaryCard title="Total" value={summaryStats.total} icon={BookOpen} />
                <SummaryCard title="Pending" value={summaryStats.pending} icon={Clock} />
                <SummaryCard title="Confirmed" value={summaryStats.confirmed} icon={CheckCircle} />
                <SummaryCard title="Cancelled" value={summaryStats.cancelled} icon={XCircle} />
                <SummaryCard title="Completed" value={summaryStats.completed} icon={CheckCircle} />
            </div>

            {/* Filters */}
            <div className="relative z-20 mb-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="p-5 border-b border-gray-200">
                    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr] xl:grid-cols-[2.4fr_1fr_1fr_1fr]">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                aria-label="Search bookings"
                                placeholder="Search by booking ID, name, or email"
                                value={searchInput}
                                onChange={(e) => { setError(null); setSearchInput(e.target.value); }}
                                className="h-12 w-full rounded-[14px] border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-green-100"
                            />
                        </div>

                        <CustomSelect
                            value={bookingStatus}
                            options={bookingStatusOptions}
                            ariaLabel="Filter bookings by status"
                            onChange={(nextValue) => { setError(null); setBookingStatus(nextValue); setOffset(0); }}
                        />

                        <CustomSelect
                            value={paymentStatus}
                            options={paymentStatusOptions}
                            ariaLabel="Filter bookings by payment status"
                            onChange={(nextValue) => { setError(null); setPaymentStatus(nextValue); setOffset(0); }}
                        />

                        <CustomSelect
                            value={dateFilter}
                            options={dateFilterOptions}
                            ariaLabel="Filter bookings by date range"
                            onChange={(nextValue) => { setError(null); setDateFilter(nextValue); setOffset(0); }}
                        />
                    </div>

                    {(search || bookingStatus || paymentStatus || dateFilter) && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                                onClick={clearFilters}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                                <X className="w-3 h-3" />
                                Reset filters
                            </button>
                            <span className="text-xs text-slate-500">Filters are active. Results show matching bookings only.</span>
                        </div>
                    )}
                </div>

                {/* Custom Date Range */}
                {dateFilter === 'custom' && (
                    <div className="flex gap-2 mt-3">
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-md"
                        />
                        <span className="text-xs text-gray-400 self-center">to</span>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-md"
                        />
                        <button
                            onClick={() => { setOffset(0); refetch(); }}
                            className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800"
                        >
                            Apply
                        </button>
                    </div>
                )}
            </div>

            {showFilterContext && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-slate-50 text-sm text-slate-700">
                    <div>
                        <span className="font-semibold text-slate-900">Bookings</span>
                        <span className="ml-2">{filterContextMessage}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                            <CalendarIcon className="w-3 h-3 text-slate-400" />
                            {displayStart === 0 ? "No results" : `${displayStart}–${displayEnd}`}
                        </span>
                        {(search || bookingStatus || paymentStatus || dateFilter) && (
                            <button
                                onClick={clearFilters}
                                className="text-xs font-medium text-green-600 hover:text-green-800"
                            >
                                Reset filters
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-50 border-b border-red-200">
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{error}</span>
                        <button onClick={() => refetch()} className="ml-auto text-xs underline">Retry</button>
                    </div>
                </div>
            )}

            {/* Booking Rows */}
            {displayBookings.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm">
                    <div className="max-h-[640px] overflow-y-auto pr-1">
                        <div className={`${bookingGridClass} sticky top-0 z-10 mb-3 hidden rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 shadow-sm backdrop-blur lg:grid`}>
                            <div>Booking ID</div>
                            <div>Customer</div>
                            <div>Service</div>
                            <div>Date</div>
                            <div>Amount</div>
                            <div>Payment</div>
                            <div>Status</div>
                            <div className="text-right">Actions</div>
                        </div>
                        <div className="space-y-3">
                            {displayBookings.map((booking) => renderBookingRow(booking))}
                        </div>
                    </div>
                </div>
            )}
            {/* Empty State */}
            {displayBookings.length === 0 && !isLoading && !error && (
                <div className="text-center py-16 px-4">
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 max-w-sm mx-auto">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{emptyStateMessage.title}</h3>
                        <p className="text-sm text-gray-600 mb-6">{emptyStateMessage.description}</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => refetch()}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Refresh
                            </button>
                            {(search || bookingStatus || paymentStatus || dateFilter) && (
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalDisplay > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                    <span className="text-xs text-gray-500">
                        {displayStart}–{displayEnd} of {totalDisplay}
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setOffset(Math.max(0, (currentPage - 2) * limit))}
                            disabled={offset === 0}
                            className="p-1.5 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-2 py-1 text-xs text-gray-600">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setOffset(Math.min((totalPages - 1) * limit, currentPage * limit))}
                            disabled={offset + limit >= totalDisplay}
                            className="p-1.5 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Booking Details Modal */}
            {isDrawerOpen && selectedBooking && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 transition-opacity duration-300"
                        onClick={() => setIsDrawerOpen(false)}
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <div className="relative w-full max-w-2xl my-8 bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 animate-in fade-in zoom-in-95">

                            {/* Header with Gradient */}
                            <div className="relative bg-gradient-to-r from-slate-50 to-white border-b border-gray-100">
                                <div className="px-8 py-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h2 className="text-2xl font-bold text-gray-900">{selectedBooking.reference}</h2>
                                                <div className="flex-shrink-0">
                                                    <StatusBadge status={selectedBooking.status} />
                                                </div>
                                            </div>
                                            <p className="mt-2 text-sm text-gray-600">
                                                {selectedBooking.guestName ?? "Guest"}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsDrawerOpen(false)}
                                            className="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
                                            aria-label="Close modal"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                                <div className="px-8 py-8 space-y-8">

                                    {/* Customer Section */}
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Customer Information</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                                                <span className="text-sm font-medium text-gray-600">Name</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {selectedBooking.guestName ?? "Guest"}
                                                </span>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 leading-relaxed border border-slate-100">
                                                All communication goes through the in-app messaging tool. No guest contact details are shown to protect privacy.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Property Section */}
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Property</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                                                <span className="text-sm font-medium text-gray-600">Listing Name</span>
                                                <span className="text-sm font-semibold text-gray-900">{selectedBooking.listingTitle || "—"}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                                                <span className="text-sm font-medium text-gray-600">Property Type</span>
                                                <span className="text-sm font-semibold text-gray-900 capitalize">{selectedBooking.listingCategory || "—"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Booking Details Section */}
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Booking Details</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                <span className="text-sm font-medium text-gray-600">Booked On</span>
                                                <span className="text-sm font-semibold text-gray-900">{formatDate(selectedBooking.createdAt)}</span>
                                            </div>
                                            {selectedBooking.checkIn && (
                                                <>
                                                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                        <span className="text-sm font-medium text-gray-600">Check-in</span>
                                                        <span className="text-sm font-semibold text-gray-900">{formatDate(selectedBooking.checkIn)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                        <span className="text-sm font-medium text-gray-600">Check-out</span>
                                                        <span className="text-sm font-semibold text-gray-900">{formatDate(selectedBooking.checkOut)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                        <span className="text-sm font-medium text-gray-600">Number of Nights</span>
                                                        <span className="text-sm font-semibold text-gray-900">{selectedBooking.nightsOrDays || "—"}</span>
                                                    </div>
                                                </>
                                            )}
                                            {selectedBooking.pickupDatetime && (
                                                <>
                                                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                        <span className="text-sm font-medium text-gray-600">Pickup</span>
                                                        <span className="text-sm font-semibold text-gray-900">{formatDateTime(selectedBooking.pickupDatetime)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                        <span className="text-sm font-medium text-gray-600">Return</span>
                                                        <span className="text-sm font-semibold text-gray-900">{formatDateTime(selectedBooking.returnDatetime)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                        <span className="text-sm font-medium text-gray-600">Number of Days</span>
                                                        <span className="text-sm font-semibold text-gray-900">{selectedBooking.nightsOrDays || "—"}</span>
                                                    </div>
                                                </>
                                            )}
                                            {selectedBooking.adults !== undefined && (
                                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                    <span className="text-sm font-medium text-gray-600">Guests</span>
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {selectedBooking.adults}{selectedBooking.children ? ` adult${selectedBooking.adults !== 1 ? 's' : ''}, ${selectedBooking.children} child${selectedBooking.children !== 1 ? 'ren' : ''}` : ' guest(s)'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Payment Section */}
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4">Payment Information</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700">Payment Status</span>
                                                <StatusBadge status={selectedBooking.paymentStatus || 'pending'} type="payment" />
                                            </div>
                                            {selectedBooking.paymentMethod && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-gray-700">Payment Method</span>
                                                    <span className="text-sm font-semibold text-gray-900">{selectedBooking.paymentMethod}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-green-200 pt-3 flex items-center justify-between">
                                                <span className="text-sm font-bold text-gray-900">Net Payout</span>
                                                <span className="text-lg font-bold text-green-600">
                                                    <NetCurrency amount={selectedBooking.providerPayout || selectedBooking.totalAmount * 0.95} currency={selectedBooking.currency} />
                                                </span>
                                            </div>
                                            {(selectedBooking.displayId || selectedBooking.transactionId) && (
                                                <div className="text-xs text-gray-600 pt-2">
                                                    <span className="font-medium">Transaction ID: </span>
                                                    <span className="font-mono text-gray-500">{selectedBooking.displayId ?? selectedBooking.transactionId}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notes Section */}
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Special Requests</h3>
                                        {selectedBooking.specialRequests || selectedBooking.notes ? (
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-sm text-gray-700 leading-relaxed">{selectedBooking.specialRequests || selectedBooking.notes}</p>
                                            </div>
                                        ) : (
                                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-sm text-gray-500 italic">No special requests</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Cancellation Info */}
                                    {selectedBooking.cancelledAt && (
                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="mb-4 flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                                                        <Ban className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-950">Booking Cancelled</p>
                                                        <p className="mt-1 text-xs text-slate-500">Booking activity update</p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                                    Cancelled
                                                </span>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                                                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        Date/Time
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-900">{formatDateTime(selectedBooking.cancelledAt)}</p>
                                                </div>
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                                                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Reason</p>
                                                    <p className="text-sm font-medium leading-5 text-slate-900">
                                                        {selectedBooking.cancellationReason || "No reason provided"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Notification Modal */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
                        <motion.div
                            className="pointer-events-auto rounded-xl bg-white shadow-2xl overflow-hidden"
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: -4 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            <div className={`px-6 py-4 ${notification.type === 'success' ? 'bg-green-50 border-b border-green-100' : 'bg-red-50 border-b border-red-100'}`}>
                                <div className="flex items-center gap-3">
                                    {notification.type === 'success' ? (
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                    )}
                                    <p className={`text-sm font-semibold ${notification.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>
                                        {notification.message}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {actionFeedback && <ActionFeedbackCard feedback={actionFeedback} />}
            </AnimatePresence>

            <AnimatePresence>
                {pendingAction && (
                    <ConfirmationDialog
                        action={pendingAction.type}
                        isPending={pendingAction.type === "approve" ? confirmMutation.isPending : cancelMutation.isPending}
                        cancelReason={cancelReason}
                        onCancelReasonChange={setCancelReason}
                        onClose={closePendingAction}
                        onConfirm={handleActionConfirm}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
