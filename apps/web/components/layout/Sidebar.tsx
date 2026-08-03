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
  CreditCard,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useListingSummary } from "@/hooks/listings";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  // Meaningless with zero listings — nothing to book, review, sync, or pay out
  // on. Hidden until the portfolio has at least one, so a brand-new host sees
  // only what they can actually use instead of a wall of empty pages.
  requiresListing?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard",           icon: <LayoutDashboard /> },
  { label: "Listings",     href: "/dashboard/listings",  icon: <Building2 /> },
  { label: "Bookings",     href: "/dashboard/bookings",  icon: <BookOpen />,        requiresListing: true },
  { label: "Calendar",     href: "/dashboard/calendar",  icon: <CalendarDays />,    requiresListing: true },
  { label: "Reviews",      href: "/dashboard/reviews",   icon: <Star />,            requiresListing: true },
  { label: "Payments",     href: "/dashboard/payments",  icon: <CreditCard />,      requiresListing: true },
  { label: "Messages",     href: "/dashboard/messaging", icon: <MessageSquare />,   requiresListing: true },
  { label: "Earnings",     href: "/dashboard/earnings",  icon: <DollarSign />,      requiresListing: true },
  { label: "Channel Sync", href: "/dashboard/channel",   icon: <Globe2 />,          requiresListing: true },
  { label: "Settings",     href: "/dashboard/settings",  icon: <Settings /> },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const { data: listingSummaryData } = useListingSummary();
  // Default to hiding the listing-dependent items until the portfolio is
  // confirmed non-empty — while loading, on error, or genuinely at zero, this
  // stays false. That means the sidebar can only grow once data resolves, never
  // flash a full list and then collapse it out from under the user.
  const hasListings = (listingSummaryData?.listings.length ?? 0) > 0;
  const navItems = NAV_ITEMS.filter((item) => !item.requiresListing || hasListings);

  // Close sidebar only when the route actually changes (not when mobileOpen toggles)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (mobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Mobile Backdrop - only on small screens */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "flex flex-col h-screen shrink-0 bg-gradient-to-b from-[#0f3d2e] via-[#134a37] to-[#0d3326]",
          // Mobile: fixed drawer, slides in/out
          "fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out",
          // Desktop: relative, always visible, no translate — width controlled by collapsed
          "md:relative md:translate-x-0 md:z-0 md:transition-all md:duration-300",
          collapsed ? "md:w-[68px]" : "md:w-64",
          // Mobile slide state
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center h-16 px-4 shrink-0 border-b border-white/10",
            collapsed ? "md:justify-center md:px-0" : "justify-between"
          )}
        >
          {/* Full logo — hidden when collapsed on desktop */}
          <div className={cn("flex items-center gap-3", collapsed && "md:hidden")}>
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
          </div>

          {/* Icon-only logo — shown when collapsed on desktop */}
          {collapsed && (
            <Link
              href="/dashboard"
              className="hidden md:flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 overflow-hidden"
            >
              <img
                src="/images/kainook-logo.jpeg"
                alt="Kainook logo"
                className="h-8 w-8 object-contain"
              />
            </Link>
          )}

          {/* Close Button - Mobile Only */}
          <button
            onClick={onCloseMobile}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-green-200 hover:bg-white/10 hover:text-white transition-all ml-auto"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-hide">
          <ul className={cn("space-y-0.5", collapsed ? "px-2" : "px-3")}>
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all duration-150",
                      isActive
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-green-100/70 hover:bg-white/8 hover:text-white",
                      collapsed && "md:justify-center md:px-0 md:py-3"
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
                    <span className={cn("truncate", collapsed && "md:hidden")}>
                      {item.label}
                    </span>
                    {item.badge && !collapsed && (
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

        {/* Collapse toggle - Desktop Only */}
        <div className="shrink-0 border-t border-white/10 p-2 hidden md:block">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-green-200/60 hover:bg-white/10 hover:text-white text-xs transition-all duration-150",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
