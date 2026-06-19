"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  BookOpen,
  Star,
  MessageSquare,
  DollarSign,
  Globe2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard",           icon: <LayoutDashboard /> },
  { label: "Listings",     href: "/dashboard/listings",  icon: <Building2 /> },
  { label: "Bookings",     href: "/dashboard/bookings",  icon: <BookOpen /> },
  { label: "Calendar",     href: "/dashboard/calendar",  icon: <CalendarDays /> },
  { label: "Reviews",      href: "/dashboard/reviews",   icon: <Star /> },
  { label: "Payements",    href: "/dashboard/payments",           icon: <LayoutDashboard /> },
  { label: "Messages",     href: "/dashboard/messaging", icon: <MessageSquare /> },
  { label: "Earnings",     href: "/dashboard/earnings",  icon: <DollarSign /> },
  { label: "Channel Sync", href: "/dashboard/channel",   icon: <Globe2 /> },
  { label: "Settings",     href: "/dashboard/settings",  icon: <Settings /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen shrink-0 transition-all duration-300 overflow-hidden",
        "bg-gradient-to-b from-[#0f3d2e] via-[#134a37] to-[#0d3326]",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4 shrink-0 border-b border-white/10",
          collapsed && "justify-center px-0"
        )}
      >
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shrink-0 overflow-hidden">
              <img
                src="/images/kainook-logo.jpeg"
                alt="Kainook logo"
                className="h-8 w-8 object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none tracking-wide">Kainook</p>
              <p className="text-[11px] text-green-300/80 mt-0.5 font-medium">Partner Portal</p>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 overflow-hidden">
            <img
              src="/images/kainook-logo.jpeg"
              alt="Kainook logo"
              className="h-8 w-8 object-contain"
            />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-hide">
        <ul className={cn("space-y-0.5", collapsed ? "px-2" : "px-3")}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-green-100/70 hover:bg-white/8 hover:text-white",
                    collapsed && "justify-center px-0 py-3"
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px]",
                      isActive ? "text-white" : "text-green-300/70"
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="ml-auto bg-white/20 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-white/10 p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-green-200/60 hover:bg-white/10 hover:text-white text-xs transition-all duration-150",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
