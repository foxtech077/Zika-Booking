"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Clock, Heart, Home, LogOut, MessageSquare, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthStore } from "@/stores/auth";
import { fetchUnreadConversationCount } from "@/services/traveller";
import { logoutUser } from "@/lib/api";

interface TravellerWorkspaceNavProps {
  showHome?: boolean;
  showAvatar?: boolean;
  orientation?: "row" | "stack";
  className?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

function unreadBadge(count: number) {
  if (count > 99) return "99+";
  return String(count);
}

export function TravellerWorkspaceNav({
  showHome = true,
  showAvatar = true,
  orientation = "row",
  className,
}: TravellerWorkspaceNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["traveller-unread-count"],
    queryFn: fetchUnreadConversationCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logoutUser();
    router.replace("/auth/login");
  };

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "Traveller";

  const items: NavItem[] = [
    ...(showHome
      ? [{ href: "/", label: "Explore", icon: <Home className="h-4 w-4" /> }]
      : []),
    {
      href: "/traveller/messages",
      label: "Messages",
      icon: <MessageSquare className="h-4 w-4" />,
      badge: unreadCount,
    },
    {
      href: "/traveller/wishlist",
      label: "Wishlist",
      icon: <Heart className="h-4 w-4" />,
    },
    {
      href: "/traveller/recently-viewed",
      label: "Recently Viewed",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      href: "/traveller/reviews",
      label: "My Reviews",
      icon: <Star className="h-4 w-4" />,
    },
  ];

  const isStack = orientation === "stack";

  return (
    <nav
      aria-label="Traveller navigation"
      className={cn(
        "flex",
        isStack ? "flex-col gap-2" : "flex-row flex-wrap items-center gap-2",
        className,
      )}
    >
      {/* Nav links */}
      {items.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/30",
              isStack ? "w-full justify-between px-4 py-3 text-sm" : "px-3 py-2 text-xs",
              isActive
                ? "border-[#0c2614] bg-[#0c2614] text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-[#1D8D2B] hover:text-[#0c2614]",
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("shrink-0", !isActive && "text-[#1D8D2B]")}>{item.icon}</span>
              <span>{item.label}</span>
            </span>
            {item.badge != null && item.badge > 0 && (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                  isActive ? "bg-white/15 text-white" : "bg-rose-100 text-rose-700",
                )}
                aria-label={`${item.badge} unread messages`}
              >
                {unreadBadge(item.badge)}
              </span>
            )}
          </Link>
        );
      })}

      {/* Avatar dropdown — hidden when showAvatar is false (e.g. mobile drawer) */}
      {showAvatar && <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            "flex items-center gap-2 rounded-2xl border px-2 py-1.5 font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/30",
            menuOpen
              ? "border-[#0c2614] bg-[#0c2614] text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-[#1D8D2B] hover:text-[#0c2614]",
          )}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar name={fullName} size="sm" />
          <div className="hidden text-left sm:block">
            <p
              className={cn(
                "max-w-[100px] truncate text-xs font-semibold leading-none",
                menuOpen ? "text-white" : "text-slate-800",
              )}
            >
              {fullName}
            </p>
            <p
              className={cn(
                "mt-0.5 max-w-[100px] truncate text-[10px]",
                menuOpen ? "text-green-200/80" : "text-slate-400",
              )}
            >
              {user?.email ?? ""}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              menuOpen ? "rotate-180 text-white/70" : "text-slate-400",
            )}
          />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 animate-slide-in-up rounded-2xl border border-slate-100 bg-white py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.1)]">
            {/* Identity header */}
            <div className="mb-1 border-b border-slate-100 px-4 py-2.5">
              <p className="truncate text-sm font-semibold text-slate-800">{fullName}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{user?.email}</p>
            </div>

            {/* Profile */}
            <button
              type="button"
              onClick={() => { setMenuOpen(false); router.push("/traveller/profile"); }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              <User className="h-4 w-4 text-green-600" />
              Profile
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Sign out */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 transition-all hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>}
    </nav>
  );
}
