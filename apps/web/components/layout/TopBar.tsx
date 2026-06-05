"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function TopBar() {
  const { user, clearSession } = useAuthStore();
  const router = useRouter();
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

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/notifications"
          aria-label="Open notifications"
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-surface-muted hover:text-slate-900 transition-all"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
              {formatUnreadCount(unreadCount)}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-surface-muted transition-all"
          >
            <Avatar name={name} size="sm" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-slate-900 leading-none">{name}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[120px]">
                {user?.businessName ?? user?.email ?? "Provider"}
              </p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-border shadow-card-lg z-20 py-1.5 animate-slide-in-up">
                <div className="px-4 py-2.5 border-b border-border mb-1">
                  <p className="text-sm font-semibold text-slate-900">{name}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); router.push("/dashboard/settings"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-surface-muted transition-all"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  Profile & Settings
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-danger hover:bg-danger-light transition-all"
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
