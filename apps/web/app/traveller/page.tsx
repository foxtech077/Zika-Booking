"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken } from "@/lib/api";
import type { ApiResponse } from "@zika/types";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: string;
  currentTier: string;
  loyaltyPoints: number;
}

export default function TravellerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("zika:access_token");
    if (!token) { router.replace("/auth/login"); return; }

    // Decode token to check role
    try {
      const parts = token.split(".");
      if (parts.length < 2 || !parts[1]) throw new Error();
      const payload = JSON.parse(atob(parts[1]));
      if (payload.type === "provider") { router.replace("/listings"); return; }
    } catch {
      router.replace("/auth/login");
      return;
    }

    // Fetch current user profile
    api.get<ApiResponse<{ user: User }>>("/auth/me")
      .then((res) => {
        if (res.data.success) setUser(res.data.data.user);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [router]);

  function handleLogout() {
    api.post("/auth/logout").catch(() => {});
    clearToken();
    router.replace("/auth/login");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/traveller" className="text-2xl font-bold text-primary">ZikaBooking</Link>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-gray-600">
              Hi, <span className="font-semibold">{user.firstName}</span>
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-800 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Welcome back{user ? `, ${user.firstName}` : ""}! 👋
        </h1>
        <p className="text-gray-500 mb-8">Explore amazing places to stay and vehicles to hire.</p>

        {/* Quick stats */}
        {user && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-1">Loyalty Tier</p>
              <p className="text-xl font-bold text-gray-900 capitalize">{user.currentTier}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-1">Loyalty Points</p>
              <p className="text-xl font-bold text-gray-900">{user.loyaltyPoints.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: "🏨", label: "Browse Hotels", href: "/search?category=hotel" },
            { icon: "🏠", label: "Browse Apartments", href: "/search?category=apartment" },
            { icon: "🚗", label: "Rent a Car", href: "/search?category=car" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition text-center"
            >
              <span className="text-4xl">{item.icon}</span>
              <span className="font-semibold text-gray-800">{item.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
