"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  BookOpen, Calendar, Search, X, CheckCircle, XCircle, Clock, 
  DollarSign, User, Eye, Check, Ban, AlertCircle, ChevronLeft, 
  ChevronRight, Phone, Mail, CreditCard, FileText, Calendar as CalendarIcon,
  TrendingUp, TrendingDown, MoreVertical
} from "lucide-react";

// Types
interface Booking {
  id: string;
  reference: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone?: string;
  listingTitle?: string;
  listingCategory?: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  totalAmount: number;
  providerPayout: number;
  commissionAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  specialRequests?: string;
  adults?: number;
  children?: number;
  transactionId?: string;
  paymentMethod?: string;
  guestCount?: number;
  notes?: string;
}

// Status Config
const bookingStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#eab308" },
  pending_payment: { label: "Pending Payment", color: "#eab308" },
  confirmed: { label: "Confirmed", color: "#22c55e" },
  cancelled: { label: "Cancelled", color: "#ef4444" },
  cancelled_by_guest: { label: "Cancelled", color: "#ef4444" },
  cancelled_by_provider: { label: "Cancelled", color: "#ef4444" },
  completed: { label: "Completed", color: "#3b82f6" },
  failed: { label: "Failed", color: "#f97316" },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  paid: { label: "Paid", color: "#22c55e" },
  pending: { label: "Pending", color: "#eab308" },
  failed: { label: "Failed", color: "#ef4444" },
  refunded: { label: "Refunded", color: "#6b7280" },
};

// Helper Functions
const formatCurrency = (amount: number, currency: string = "USD") => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const formatDate = (date?: string) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (date?: string) => {
  if (!date) return "—";
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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
  <div className="bg-white rounded-lg border border-gray-200 p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
      <div className="p-1.5 rounded-md bg-gray-50">
        <Icon className="w-3.5 h-3.5 text-gray-500" />
      </div>
    </div>
    <div className="flex items-baseline justify-between">
      <span className="text-2xl font-semibold text-gray-900">{value}</span>
      {trend && (
        <span className={`text-xs font-medium flex items-center gap-0.5 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
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
          {booking.guestFirstName} {booking.guestLastName}
        </span>
      </div>
      {booking.guestPhone && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Phone className="w-3 h-3" />
          <span>{booking.guestPhone}</span>
        </div>
      )}
    </div>
    
    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
      <div>
        <span className="text-xs text-gray-500">Total</span>
        <div className="text-sm font-semibold text-gray-900">
          {formatCurrency(booking.totalAmount, booking.currency)}
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

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const limit = 10;

  // Fetch Bookings
  const params: any = { offset, limit };
  if (search) params.search = search;
  if (bookingStatus) params.status = bookingStatus;
  if (paymentStatus) params.paymentStatus = paymentStatus;
  if (dateFilter === 'today') {
    const today = new Date().toISOString().split('T')[0];
    params.startDate = today;
    params.endDate = today;
  } else if (dateFilter === 'week') {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    params.startDate = start.toISOString().split('T')[0];
    params.endDate = end.toISOString().split('T')[0];
  } else if (dateFilter === 'month') {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 1);
    params.startDate = start.toISOString().split('T')[0];
    params.endDate = end.toISOString().split('T')[0];
  } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
    params.startDate = customStartDate;
    params.endDate = customEndDate;
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["provider-bookings", params],
    queryFn: async () => {
      setError(null);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        throw new Error("Please log in to view bookings");
      }
      
      try {
        // API call - replace with your actual endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/provider/bookings?${new URLSearchParams(params)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.status === 401) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          throw new Error("Session expired. Please log in again.");
        }
        
        if (!response.ok) {
          throw new Error("Failed to fetch bookings");
        }
        
        const result = await response.json();
        return {
          bookings: result.bookings || result.data || [],
          total: result.total || 0,
        };
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    retry: false,
  });

  const bookings: Booking[] = data?.bookings || [];
  const total: number = data?.total || 0;

  // Summary Stats
  const stats = {
    total: total,
    pending: bookings.filter(b => b.status === 'pending' || b.status === 'pending_payment').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    cancelled: bookings.filter(b => b.status.includes('cancelled')).length,
    completed: bookings.filter(b => b.status === 'completed').length,
  };

  // Mutations
  const confirmMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/${bookingId}/confirm`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error("Failed to confirm booking");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-bookings"] });
      alert("Booking confirmed successfully!");
    },
    onError: (err: any) => alert(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/provider/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error("Failed to cancel booking");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-bookings"] });
      alert("Booking cancelled successfully!");
    },
    onError: (err: any) => alert(err.message),
  });

  // Handlers
  const handleConfirm = (bookingId: string) => {
    if (window.confirm("Confirm this booking?")) {
      confirmMutation.mutate(bookingId);
    }
  };

  const handleCancel = (bookingId: string) => {
    const reason = window.prompt("Cancellation reason:");
    if (reason) {
      cancelMutation.mutate({ bookingId, reason });
    }
  };

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDrawerOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setBookingStatus("");
    setPaymentStatus("");
    setDateFilter("");
    setCustomStartDate("");
    setCustomEndDate("");
    setOffset(0);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  // Render Action Buttons
  const renderActions = (booking: Booking) => {
    const status = booking.status;
    
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
            onClick={() => handleCancel(booking.id)}
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
            onClick={() => handleCancel(booking.id)}
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

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="p-4 md:p-5">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Bookings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage and monitor all customer bookings</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <SummaryCard title="Total" value={stats.total} icon={BookOpen} />
        <SummaryCard title="Pending" value={stats.pending} icon={Clock} />
        <SummaryCard title="Confirmed" value={stats.confirmed} icon={CheckCircle} />
        <SummaryCard title="Cancelled" value={stats.cancelled} icon={XCircle} />
        <SummaryCard title="Completed" value={stats.completed} icon={CheckCircle} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 mb-5">
        <div className="p-4 border-b border-gray-200">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID, name, or phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-2">
            <select
              value={bookingStatus}
              onChange={(e) => { setBookingStatus(e.target.value); setOffset(0); }}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={paymentStatus}
              onChange={(e) => { setPaymentStatus(e.target.value); setOffset(0); }}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All Payment</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setOffset(0); }}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>

            {(search || bookingStatus || paymentStatus || dateFilter) && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
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

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Booking ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Service</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Payment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-900">{booking.reference}</span>
                    <div className="text-xs text-gray-400">{formatDate(booking.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {booking.guestFirstName} {booking.guestLastName}
                    </div>
                    {booking.guestPhone && (
                      <div className="text-xs text-gray-500">{booking.guestPhone}</div>
                    )}
                   </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate max-w-[180px]">
                      {booking.listingTitle || "—"}
                    </div>
                   </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(booking.checkIn || booking.pickupDatetime)}
                   </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(booking.totalAmount, booking.currency)}
                    </span>
                   </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={booking.paymentStatus || 'pending'} type="payment" />
                   </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={booking.status} />
                   </td>
                  <td className="px-4 py-3">
                    {renderActions(booking)}
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3 p-4">
          {bookings.map((booking) => (
            <MobileBookingCard key={booking.id} booking={booking} onViewDetails={handleViewDetails} />
          ))}
        </div>

        {/* Empty State */}
        {bookings.length === 0 && !isLoading && !error && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No bookings found</p>
            <p className="text-xs text-gray-400 mt-1">Bookings will appear here once customers make reservations</p>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="p-1.5 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 py-1 text-xs text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(Math.min(total - limit, offset + limit))}
                disabled={offset + limit >= total}
                className="p-1.5 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 rounded-md transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Drawer */}
      {isDrawerOpen && selectedBooking && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Booking Details</h2>
                <p className="text-xs text-gray-500 font-mono">{selectedBooking.reference}</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status */}
              <div className="flex justify-end">
                <StatusBadge status={selectedBooking.status} />
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</h3>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedBooking.guestFirstName} {selectedBooking.guestLastName}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <Mail className="w-3 h-3" />
                    <span>{selectedBooking.guestEmail}</span>
                  </div>
                  {selectedBooking.guestPhone && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" />
                      <span>{selectedBooking.guestPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Booking Date</p>
                    <p className="font-medium text-gray-900">{formatDate(selectedBooking.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Travel Date</p>
                    <p className="font-medium text-gray-900">{formatDate(selectedBooking.checkIn || selectedBooking.pickupDatetime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Service</p>
                    <p className="font-medium text-gray-900">{selectedBooking.listingTitle || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Guests</p>
                    <p className="font-medium text-gray-900">{selectedBooking.adults || selectedBooking.guestCount || 1}</p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Method</span>
                    <span className="font-medium text-gray-900">{selectedBooking.paymentMethod || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <StatusBadge status={selectedBooking.paymentStatus || 'pending'} type="payment" />
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Total Amount</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatCurrency(selectedBooking.totalAmount, selectedBooking.currency)}
                    </span>
                  </div>
                  {selectedBooking.transactionId && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Transaction ID</span>
                      <span className="font-mono text-gray-500">{selectedBooking.transactionId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              {(selectedBooking.specialRequests || selectedBooking.notes) && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</h3>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700">{selectedBooking.specialRequests || selectedBooking.notes}</p>
                  </div>
                </div>
              )}

              {/* Cancellation Info */}
              {selectedBooking.cancelledAt && (
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <p className="text-sm font-medium text-red-600">Cancelled</p>
                  <p className="text-xs text-red-600 mt-1">{formatDateTime(selectedBooking.cancelledAt)}</p>
                  {selectedBooking.cancellationReason && (
                    <p className="text-xs text-red-600 mt-1">{selectedBooking.cancellationReason}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}