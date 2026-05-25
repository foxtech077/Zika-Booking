"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2, BookOpen, DollarSign, Star,
  MessageSquare, TrendingUp, CheckCircle, Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { listingApi } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";
import { StatCard, RevenueAreaChart } from "@/components/charts/Charts";
import { Card, CardHeader, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";
import type { DashboardData } from "@/types/provider";

const fetchDashboard = () =>
  listingApi.get<{ success: boolean; data: DashboardData }>("/provider/dashboard")
    .then((r) => r.data.data);

const STATUS_COLORS: Record<string, string> = {
  confirmed:           "success",
  completed:           "success",
  pending_payment:     "warning",
  cancelled_by_guest:  "danger",
  cancelled_by_provider: "danger",
  cancelled_by_system: "danger",
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["provider-dashboard"],
    queryFn:  fetchDashboard,
    refetchInterval: 60_000,
  });

  const monthlyData = (data?.monthlyRevenue ?? []).map((m) => ({
    ...m,
    label: formatMonthLabel(m.month),
  }));

  const firstName = user?.firstName ?? "Partner";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good morning, {firstName} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Here&apos;s an overview of your performance today
          </p>
        </div>
        <Link href="/dashboard/listings/new">
          <Button variant="primary" icon={<Building2 />} id="new-listing-btn">
            New Listing
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Earnings"
              value={formatCurrency(data?.totalEarnings ?? 0)}
              subtitle="All time"
              icon={<DollarSign />}
              color="emerald"
            />
            <StatCard
              title="This Month"
              value={formatCurrency(data?.thisMonthEarnings ?? 0)}
              subtitle="Provider payout"
              icon={<TrendingUp />}
              color="blue"
            />
            <StatCard
              title="Active Listings"
              value={data?.activeListingsCount ?? 0}
              subtitle="Live on platform"
              icon={<Building2 />}
              color="violet"
            />
            <StatCard
              title="Upcoming Bookings"
              value={data?.pendingBookingsCount ?? 0}
              subtitle="Confirmed stays"
              icon={<BookOpen />}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Completed</p>
            <p className="font-bold text-slate-900">{data?.completedBookingsCount ?? 0}</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <MessageSquare className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Unread Messages</p>
            <p className="font-bold text-slate-900">{data?.unreadMessages ?? 0}</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <Star className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Reviews Pending Reply</p>
            <p className="font-bold text-slate-900">{data?.pendingReviews ?? 0}</p>
          </div>
        </Card>
      </div>

      {/* Revenue Chart + Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue Trend"
            subtitle="Last 6 months — provider payout"
            icon={<TrendingUp />}
            action={
              <Link href="/dashboard/earnings">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            }
          />
          {isLoading ? (
            <div className="h-52 bg-slate-50 rounded-xl animate-shimmer" />
          ) : (
            <RevenueAreaChart data={data?.monthlyRevenue ?? []} />
          )}
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader title="Quick Actions" icon={<Clock />} />
          <div className="space-y-2">
            {[
              { label: "Add New Listing",  href: "/dashboard/listings/new",  icon: "🏠" },
              { label: "View Bookings",    href: "/dashboard/bookings",      icon: "📅" },
              { label: "Check Messages",   href: "/dashboard/messaging",     icon: "💬" },
              { label: "Review Responses", href: "/dashboard/reviews",       icon: "⭐" },
              { label: "Sync Calendar",    href: "/dashboard/channel",       icon: "🔄" },
              { label: "Earnings Report",  href: "/dashboard/earnings",      icon: "💰" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-muted transition-all group"
              >
                <span className="text-lg">{a.icon}</span>
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{a.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-auto group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card>
        <SectionHeader
          title="Recent Bookings"
          subtitle="Latest booking activity"
          action={
            <Link href="/dashboard/bookings">
              <Button variant="outline" size="sm">View all bookings</Button>
            </Link>
          }
        />
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : data?.recentBookings?.length === 0 ? (
          <div className="text-center py-10">
            <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No bookings yet</p>
            <p className="text-slate-400 text-xs mt-1">Bookings will appear here once guests book your listings</p>
          </div>
        ) : (
          <div className="space-y-1">
            {data?.recentBookings?.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-muted transition-all"
              >
                <Avatar name={b.guestName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{b.guestName}</p>
                  <p className="text-xs text-slate-500 truncate">{b.listingTitle ?? "—"} · {b.reference}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(b.providerPayout, b.currency)}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(b.checkIn ?? b.pickupDatetime)}</p>
                </div>
                <Badge label={b.status} status={b.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
