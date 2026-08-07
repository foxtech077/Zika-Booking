"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, BadgeCheck, Building2, CalendarDays,
  Star, MessageSquare, Cable, DollarSign, Percent, Ticket,
  ShieldCheck, ClipboardList, BarChart3, Settings,
  ChevronLeft, ChevronRight, LogOut,
  CreditCard, Coins, RotateCcw, History, Tag, Store, ShieldAlert,
} from "lucide-react";
import { cn, slugToLabel, getCountryNames } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { canAccess, roleScopePolicy, AdminScope, NAV_GROUPS, type Permission } from "@/permissions/rbac";
import type { AdminRole } from "@/types/admin";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/api";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, BadgeCheck, Building2, CalendarDays,
  Star, MessageSquare, Cable, DollarSign, Percent, Ticket,
  ShieldCheck, ClipboardList, BarChart3, Settings,
  CreditCard, Coins, RotateCcw, History, Tag, Store, ShieldAlert,
};

const ROLE_BADGE_COLORS: Record<AdminRole, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  country_manager: "bg-teal-100 text-teal-700",
  sales: "bg-green-100 text-green-700",
  support: "bg-orange-100 text-orange-700",
  finance: "bg-indigo-100 text-indigo-700",
};

export function Sidebar() {
  const { user, clearSession } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const role = user?.role as AdminRole | undefined;

  const handleLogout = async () => {
    try {
      await api.post("/admin/auth/logout");
    } catch (err) {
      console.error("Logout API failed:", err);
    } finally {
      clearSession();
      router.push("/login");
    }
  };

  return (
    <aside
      className={cn(
        "relative flex flex-col sidebar-bg border-r border-white/10",
        "transition-[width] duration-300 ease-in-out flex-shrink-0",
        "h-screen sticky top-0",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-[60px] flex-shrink-0 border-b border-white/10",
        collapsed ? "justify-center px-2" : "px-5 gap-3"
      )}>
        <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden bg-white shadow">
          <img src="/admin/kainook-logo.png" alt="Kainook" className="h-8 w-8 object-contain" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-none">Kainook</p>
            <p className="text-white/50 text-xs mt-0.5">Admin Panel</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-3">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) =>
            canAccess(role, item.permission as Permission)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className={cn("mb-1", !collapsed && "mb-2")}>
              {!collapsed && (
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest header-green">
                  {group.group}
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 font-medium transition-colors duration-150 group",
                      collapsed
                        ? "justify-center mx-2 px-0 py-2.5 rounded-lg"
                        : "mx-2 px-3 py-2 rounded-lg",
                      isActive
                        ? "nav-active"
                        : "text-white hover:text-white hover:bg-white/12"
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn(
                          "flex-shrink-0 icon-green",
                          collapsed ? "h-5 w-5" : "h-4 w-4",
                          isActive ? "text-white" : "text-white/60 group-hover:text-white"
                        )}
                      />
                    )}
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
              {!collapsed && <div className="mx-4 mt-2 border-t border-white/5" />}
            </div>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className={cn(
        "flex-shrink-0 border-t border-white/10 py-3 bg-[#064e3b]",
        collapsed ? "px-2" : "px-3"
      )}>
        {user && !collapsed && (
          <div className="flex items-center gap-2.5 px-2 mb-2">
            <Avatar name={user.name} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <div className="flex flex-col items-start gap-1">
                <span className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  ROLE_BADGE_COLORS[user.role] ?? "bg-slate-100 text-slate-600"
                )}>
                  {slugToLabel(user.role)}
                </span>
                {roleScopePolicy(user.role as AdminRole) === AdminScope.CountryScoped && (
                  <p className="text-[10px] text-white/50 leading-relaxed break-words whitespace-normal mt-0.5">
                    {getCountryNames(user.countryScope)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Logout"
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm",
            "text-secondary hover:text-white hover:bg-white/12 transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          "absolute -right-3 top-[72px] z-10",
          "flex h-6 w-6 items-center justify-center rounded-full",
          "bg-sidebar-bg border border-white/20 text-white/60",
          "hover:text-white hover:border-white/40 transition-colors shadow-sm"
        )}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
