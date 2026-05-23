"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listingApi } from "@/lib/listing-api";
import { api } from "@/lib/api";

interface ReviewQueueData {
  total: number;
}

interface UsersData {
  total: number;
}

interface ListingsData {
  total: number;
}

export default function DashboardPage() {
  const { data: queueData } = useQuery<ReviewQueueData>({
    queryKey: ["dashboard-queue-count"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ReviewQueueData }>("/admin/listings/review-queue?limit=1");
      return res.data.data;
    },
  });

  const { data: usersData } = useQuery<UsersData>({
    queryKey: ["dashboard-users-count"],
    queryFn: async () => {
      const res = await api.get<{ data: UsersData }>("/admin/users?limit=1");
      return res.data.data;
    },
  });

  const { data: listingsData } = useQuery<ListingsData>({
    queryKey: ["dashboard-listings-count"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ListingsData }>("/admin/listings?limit=1");
      return res.data.data;
    },
  });

  const { data: pendingListingsData } = useQuery<ListingsData>({
    queryKey: ["dashboard-pending-count"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ListingsData }>("/admin/listings?status=pending_review&limit=1");
      return res.data.data;
    },
  });

  const stats = [
    {
      label: "Pending Hotel Reviews",
      value: queueData?.total ?? pendingListingsData?.total ?? null,
      href: "/dashboard/listings",
      urgent: (queueData?.total ?? 0) > 0,
    },
    {
      label: "Total Users",
      value: usersData?.total ?? null,
      href: "/dashboard/users",
      urgent: false,
    },
    {
      label: "Total Listings",
      value: listingsData?.total ?? null,
      href: "/dashboard/listings",
      urgent: false,
    },
    {
      label: "Active Listings",
      value: null, // placeholder — no dedicated endpoint
      href: "/dashboard/listings",
      urgent: false,
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Overview</h1>
      <p className="text-sm text-gray-500 mb-8">Welcome to the ZikaBooking admin panel.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`bg-white rounded-xl border p-5 hover:shadow-sm transition ${stat.urgent ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}
          >
            <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.urgent ? "text-amber-600" : "text-gray-900"}`}>
              {stat.value === null ? "—" : stat.value.toLocaleString()}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            href: "/dashboard/listings",
            title: "Hotel Review Queue",
            description: "Review and approve or reject hotel listings pending accreditation.",
          },
          {
            href: "/dashboard/users",
            title: "User Management",
            description: "Suspend, ban or reinstate user accounts.",
          },
          {
            href: "/dashboard/commission",
            title: "Commission Rates",
            description: "Set country-specific commission rates or update the global default.",
          },
          {
            href: "/dashboard/vouchers",
            title: "Vouchers",
            description: "Create and manage promotional discount vouchers.",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary hover:shadow-sm transition"
          >
            <h3 className="font-semibold text-gray-900 mb-1 text-sm">{item.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
