"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Home, MessageSquare, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchUnreadConversationCount } from "@/services/traveller";

interface TravellerWorkspaceNavProps {
  showHome?: boolean;
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
  orientation = "row",
  className,
}: TravellerWorkspaceNavProps) {
  const pathname = usePathname();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["traveller-unread-count"],
    queryFn: fetchUnreadConversationCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const items: NavItem[] = [
    ...(showHome ? [{ href: "/traveller", label: "Explore", icon: <Home className="h-4 w-4" /> }] : []),
    {
      href: "/traveller/messages",
      label: "Messages",
      icon: <MessageSquare className="h-4 w-4" />,
      badge: unreadCount,
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
      {items.map((item) => {
        const isActive = item.href === "/traveller"
          ? pathname === "/traveller"
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
            {item.badge && item.badge > 0 && (
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
    </nav>
  );
}
