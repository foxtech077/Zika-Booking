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
  | "manage_manual_booking"
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
  | "manage_roles"
  | "view_refunds";

// Role → set of permissions
const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    "view_dashboard", "view_users", "manage_users",
    "view_accreditation", "manage_accreditation",
    "view_listings", "manage_listings",
    "view_bookings", "manage_bookings", "manage_manual_booking",
    "view_finance", "manage_finance",
    "view_commission", "manage_commission",
    "view_vouchers", "manage_vouchers",
    "view_reviews", "manage_reviews",
    "view_messaging",
    "view_channel", "manage_channel",
    "view_audit",
    "view_reports",
    "view_refunds",
    "view_settings", "manage_settings",
    "view_roles", "manage_roles",
  ],
  admin: [
    "view_dashboard", "view_users", "manage_users",
    "view_accreditation", "manage_accreditation",
    "view_listings", "manage_listings",
    "view_bookings", "manage_bookings", "manage_manual_booking",
    "view_finance",
    "view_commission", "manage_commission",
    "view_vouchers", "manage_vouchers",
    "view_reviews", "manage_reviews",
    "view_messaging",
    "view_channel", "manage_channel",
    "view_audit",
    "view_reports",
    "view_refunds",
    // "view_settings" removed — global platform settings is super_admin only
    "view_roles",
  ],
  country_manager: [
    "view_dashboard",
    "view_accreditation", "manage_accreditation",
    "view_listings", "manage_listings",
    "view_bookings", "manage_manual_booking",
    "view_finance",
    "view_reviews",
    "view_messaging",
    "view_channel",
    "view_reports",
  ],
  sales: [
    "view_dashboard",
    "view_bookings",
    "manage_manual_booking",
    "view_messaging",
  ],
  support: [
    "view_dashboard",
    "view_bookings",
    "view_messaging",
    "view_refunds",
  ],
  finance: [
    "view_dashboard",
    "view_finance", "manage_finance",
    "view_commission", "manage_commission",
    "view_audit",
    "view_refunds",
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

/**
 * Returns the set of roles that the given role is allowed to create or assign.
 * - super_admin → all non-super_admin roles
 * - admin       → only country_manager and sales
 * - others      → none
 */
export function getAllowedRolesToCreate(role: AdminRole | undefined | null): AdminRole[] {
  if (role === "super_admin") {
    return ["admin", "country_manager", "sales", "support", "finance"];
  }
  if (role === "admin") {
    return ["country_manager", "sales"];
  }
  return [];
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
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: "view_dashboard" },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Users", href: "/dashboard/users", icon: "Users", permission: "view_users" },
      { label: "Accreditation", href: "/dashboard/accreditation", icon: "BadgeCheck", permission: "view_accreditation" },
      { label: "Listings", href: "/dashboard/listings", icon: "Building2", permission: "view_listings" },
      { label: "Bookings", href: "/dashboard/bookings", icon: "CalendarDays", permission: "view_bookings" },
      { label: "Reviews", href: "/dashboard/reviews", icon: "Star", permission: "view_reviews" },
      { label: "Messaging", href: "/dashboard/messaging", icon: "MessageSquare", permission: "view_messaging" },
      { label: "Channel Sync", href: "/dashboard/channel", icon: "Cable", permission: "view_channel" },
    ],
  },
  {
    group: "Finance",
    items: [
      { label: "Payment Dashboard", href: "/dashboard/finance", icon: "LayoutDashboard", permission: "view_finance" },
      { label: "Booking Payments", href: "/dashboard/finance/payments", icon: "CreditCard", permission: "view_finance" },
      { label: "Payout Management", href: "/dashboard/finance/payouts", icon: "Coins", permission: "view_finance" },
      { label: "Commission Settings", href: "/dashboard/commission", icon: "Percent", permission: "view_commission" },
      { label: "Commission History", href: "/dashboard/commission/history", icon: "History", permission: "view_commission" },
      { label: "Financial Reports", href: "/dashboard/finance/reports", icon: "BarChart3", permission: "view_finance" },
      { label: "Refund Management", href: "/dashboard/finance/refunds", icon: "RotateCcw", permission: "view_refunds" },
      { label: "Vouchers", href: "/dashboard/vouchers", icon: "Ticket", permission: "view_vouchers" },
    ],
  },

  {
    group: "Administration",
    items: [
      { label: "Roles & Admins", href: "/dashboard/roles", icon: "ShieldCheck", permission: "view_roles" },
      { label: "Audit Trail", href: "/dashboard/audit", icon: "ClipboardList", permission: "view_audit" },
      { label: "Reports", href: "/dashboard/reports", icon: "BarChart3", permission: "view_reports" },
      { label: "Settings", href: "/dashboard/settings", icon: "Settings", permission: "view_settings" },
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
