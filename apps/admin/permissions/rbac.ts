import type { AdminRole } from "@/types/admin";

// ── Permission definitions ────────────────────────────────────────────────────

export type Permission =
  | "view_dashboard"
  | "view_users"
  | "manage_users"
  | "view_accreditation"
  | "manage_accreditation"
  | "view_listings"
  | "manage_listings"
  | "view_bookings"
  | "manage_bookings"
  | "view_finance"
  | "manage_finance"
  | "view_commission"
  | "manage_commission"
  | "view_vouchers"
  | "manage_vouchers"
  | "view_reviews"
  | "manage_reviews"
  | "view_messaging"
  | "view_channel"
  | "manage_channel"
  | "view_audit"
  | "view_reports"
  | "view_settings"
  | "manage_settings"
  | "view_roles"
  | "manage_roles";

// Role → set of permissions
const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    "view_dashboard", "view_users", "manage_users",
    "view_accreditation", "manage_accreditation",
    "view_listings", "manage_listings",
    "view_bookings", "manage_bookings",
    "view_finance", "manage_finance",
    "view_commission", "manage_commission",
    "view_vouchers", "manage_vouchers",
    "view_reviews", "manage_reviews",
    "view_messaging",
    "view_channel", "manage_channel",
    "view_audit",
    "view_reports",
    "view_settings", "manage_settings",
    "view_roles", "manage_roles",
  ],
  admin: [
    "view_dashboard", "view_users", "manage_users",
    "view_accreditation", "manage_accreditation",
    "view_listings", "manage_listings",
    "view_bookings", "manage_bookings",
    "view_finance",
    "view_commission", "manage_commission",
    "view_vouchers", "manage_vouchers",
    "view_reviews", "manage_reviews",
    "view_messaging",
    "view_channel", "manage_channel",
    "view_audit",
    "view_reports",
    "view_settings",
    "view_roles",
  ],
  country_manager: [
    "view_dashboard",
    "view_accreditation", "manage_accreditation",
    "view_listings", "manage_listings",
    "view_bookings",
    "view_finance",
    "view_reviews",
    "view_messaging",
    "view_channel",
    "view_reports",
  ],
  sales: [
    "view_dashboard",
    "view_listings",
    "view_bookings",
    "view_vouchers", "manage_vouchers",
    "view_commission",
    "view_reports",
  ],
  support: [
    "view_dashboard",
    "view_users",
    "view_bookings", "manage_bookings",
    "view_listings",
    "view_reviews", "manage_reviews",
    "view_messaging",
  ],
  finance: [
    "view_dashboard",
    "view_finance", "manage_finance",
    "view_commission", "manage_commission",
    "view_bookings",
    "view_reports",
    "view_audit",
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function canAccess(role: AdminRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: AdminRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// ── Sidebar navigation with RBAC ─────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Lucide icon name
  permission: Permission;
  badge?: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard",     href: "/dashboard",              icon: "LayoutDashboard", permission: "view_dashboard" },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Users",          href: "/dashboard/users",         icon: "Users",           permission: "view_users" },
      { label: "Accreditation",  href: "/dashboard/accreditation", icon: "BadgeCheck",      permission: "view_accreditation" },
      { label: "Listings",       href: "/dashboard/listings",      icon: "Building2",       permission: "view_listings" },
      { label: "Bookings",       href: "/dashboard/bookings",      icon: "CalendarDays",    permission: "view_bookings" },
      { label: "Reviews",        href: "/dashboard/reviews",       icon: "Star",            permission: "view_reviews" },
      { label: "Messaging",      href: "/dashboard/messaging",     icon: "MessageSquare",   permission: "view_messaging" },
      { label: "Channel Sync",   href: "/dashboard/channel",       icon: "Cable",           permission: "view_channel" },
    ],
  },
  {
    group: "Finance",
    items: [
      { label: "Finance",        href: "/dashboard/finance",       icon: "DollarSign",      permission: "view_finance" },
      { label: "Commission",     href: "/dashboard/commission",    icon: "Percent",         permission: "view_commission" },
      { label: "Vouchers",       href: "/dashboard/vouchers",      icon: "Ticket",          permission: "view_vouchers" },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Roles & Admins", href: "/dashboard/roles",         icon: "ShieldCheck",     permission: "view_roles" },
      { label: "Audit Trail",    href: "/dashboard/audit",         icon: "ClipboardList",   permission: "view_audit" },
      { label: "Reports",        href: "/dashboard/reports",       icon: "BarChart3",       permission: "view_reports" },
      { label: "Settings",       href: "/dashboard/settings",      icon: "Settings",        permission: "view_settings" },
    ],
  },
];

// ── PermissionGate component ──────────────────────────────────────────────────

import type { ReactNode } from "react";

interface PermissionGateProps {
  role: AdminRole | undefined | null;
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ role, permission, fallback = null, children }: PermissionGateProps) {
  return canAccess(role, permission) ? children as JSX.Element : fallback as JSX.Element;
}
