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
  Zap,
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
  { label: "Dashboard",    href: "/dashboard",             icon: <LayoutDashboard /> },
  { label: "Listings",     href: "/dashboard/listings",    icon: <Building2 /> },
  { label: "Bookings",     href: "/dashboard/bookings",    icon: <BookOpen /> },
  { label: "Calendar",     href: "/dashboard/calendar",    icon: <CalendarDays /> },
  { label: "Reviews",      href: "/dashboard/reviews",     icon: <Star /> },
  { label: "Messages",     href: "/dashboard/messaging",   icon: <MessageSquare /> },
  { label: "Earnings",     href: "/dashboard/earnings",    icon: <DollarSign /> },
  { label: "Channel Sync", href: "/dashboard/channel",     icon: <Globe2 /> },
  { label: "Settings",     href: "/dashboard/settings",    icon: <Settings /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-white border-r border-border shrink-0 transition-all duration-300 overflow-hidden",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-16 border-b border-border px-4 shrink-0", collapsed && "justify-center px-0")}>
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">ZikaBooking</p>
              <p className="text-xs text-slate-500 mt-0.5">Partner Portal</p>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-hide">
        <ul className="space-y-1 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/dashboard"
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
                      ? "bg-primary-50 text-primary-700 font-semibold shadow-sm"
                      : "text-slate-600 hover:bg-surface-muted hover:text-slate-900",
                    collapsed && "justify-center px-0 py-3"
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px]",
                      isActive ? "text-primary" : "text-slate-400"
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="ml-auto bg-primary text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
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
      <div className="shrink-0 border-t border-border p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:bg-surface-muted text-xs transition-all",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
