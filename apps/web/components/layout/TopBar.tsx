"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, User, ChevronDown } from "lucide-react";
import { listingsService } from "@/services/listings";
import { useAuthStore } from "@/stores/auth";
import { Avatar } from "@/components/ui/Avatar";
import { useState } from "react";
import { cn } from "@/lib/utils";

async function fetchUnreadNotifications() {
  try {
    const data = await listingsService.getDashboard();
    return Number(data.unreadMessages ?? 0) + Number(data.pendingReviews ?? 0);
  } catch {
    return 0;
  }
}

function formatUnreadCount(count: number) {
  if (count > 99) return "99+";
  if (count > 9) return "9+";
  return String(count);
}

/** Derive a human-readable page title from the current pathname */
// function getPageTitle(pathname: string): string {
//   const segments = pathname.split("/").filter(Boolean);
//   const last = segments[segments.length - 1];
//   if (!last || last === "dashboard") return "Dashboard";
//   const map: Record<string, string> = {
//     listings:      "Listings",
//     bookings:      "Bookings",
//     calendar:      "Calendar",
//     reviews:       "Reviews",
//     messaging:     "Messages",
//     earnings:      "Earnings",
//     channel:       "Channel Sync",
//     settings:      "Settings",
//     notifications: "Notifications",
//     new:           "New Listing",
//     edit:          "Edit Listing",
//   };
//   return map[last] ?? last.charAt(0).toUpperCase() + last.slice(1);
// }

export function TopBar() {
  const { user, clearSession } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["provider-dashboard-alert-count"],
    queryFn: fetchUnreadNotifications,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const handleLogout = () => {
    clearSession();
    router.replace("/auth/login");
  };

  const name = user ? `${user.firstName} ${user.lastName}` : "Provider";
  // const pageTitle = getPageTitle(pathname);

  return (
    <header
      className="
        h-16
        bg-gradient-to-r
        from-[#1a5a45]
        via-[#216b52]
        to-[#1a5a45]
        border-b border-[#2d7a61]
        flex items-center justify-between
        px-6 shrink-0 z-10
        shadow-[0_1px_4px_rgba(0,0,0,0.04)]
      "
    >
      {/* Left — page title */}
      <div>
        {/* <h1 className="text-base font-bold text-white leading-none">{pageTitle}</h1> */}
      </div>

      {/* Right — notification + user */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <Link
          href="/dashboard/notifications"
          aria-label="Open notifications"
          className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-[#1a5a45]">
              {formatUnreadCount(unreadCount)}
            </span>
          )}
        </Link>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 transition-all border border-white/10"
          >
            <Avatar name={name} size="sm" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-white leading-none">{name}</p>
              <p className="text-[11px] text-green-200/80 mt-0.5 truncate max-w-[120px]">
                {user?.businessName ?? user?.email ?? "Provider"}
              </p>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-white/60 transition-transform ml-0.5", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.1)] z-20 py-1.5 animate-slide-in-up">
                <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
                  <p className="text-sm font-semibold text-slate-800">{name}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); router.push("/dashboard/settings"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <User className="w-4 h-4 text-green-600" />
                  Profile &amp; Settings
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
