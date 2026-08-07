// ── Admin authorization model ────────────────────────────────────────────────
// Single source of truth for admin roles, permissions and country scope.
// Used by auth-service (canonical session introspection) and payment-service
// (backend enforcement). No authorization magic strings in route handlers.

export enum AdminRole {
  SuperAdmin = "super_admin",
  Admin = "admin",
  CountryManager = "country_manager",
  Sales = "sales",
  Support = "support",
  Finance = "finance",
}

export enum AdminPermission {
  PaymentsRead = "payments.read",
  RefundsRead = "refunds.read",
  RefundsProcess = "refunds.process",
  PayoutsRead = "payouts.read",
  PayoutsManage = "payouts.manage",
  MerchantsRead = "merchants.read",
  MerchantsManage = "merchants.manage",
}

export enum AdminResource {
  Payment = "payment",
  Refund = "refund",
  Payout = "payout",
  Merchant = "merchant",
}

export enum AdminAction {
  Read = "read",
  Process = "process",
  Manage = "manage",
  Verify = "verify",
}

export enum AdminScope {
  Global = "global",
  CountryScoped = "country_scoped",
}

export enum AuthorizationErrorCode {
  MissingSession = "AUTH_SESSION_REQUIRED",
  InvalidSession = "AUTH_SESSION_INVALID",
  SessionExpired = "AUTH_SESSION_EXPIRED",
  PermissionDenied = "AUTH_PERMISSION_DENIED",
  ScopeDenied = "AUTH_SCOPE_DENIED",
  IntrospectionUnavailable = "AUTH_INTROSPECTION_UNAVAILABLE",
}

/**
 * Role → allowed permissions for payment-service admin APIs.
 * Derived from the PRD permission matrix and the existing admin frontend RBAC.
 */
export const ADMIN_ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly AdminPermission[]>> = {
  [AdminRole.SuperAdmin]: Object.values(AdminPermission),
  [AdminRole.Admin]: [
    AdminPermission.PaymentsRead,
    AdminPermission.RefundsRead,
    AdminPermission.RefundsProcess,
    AdminPermission.PayoutsRead,
    AdminPermission.PayoutsManage,
    AdminPermission.MerchantsRead,
    AdminPermission.MerchantsManage,
  ],
  [AdminRole.CountryManager]: [
    AdminPermission.PaymentsRead,
    AdminPermission.RefundsRead,
    AdminPermission.RefundsProcess,
    AdminPermission.PayoutsRead,
  ],
  [AdminRole.Sales]: [],
  [AdminRole.Support]: [],
  [AdminRole.Finance]: [
    AdminPermission.PaymentsRead,
    AdminPermission.RefundsRead,
    AdminPermission.PayoutsRead,
    AdminPermission.PayoutsManage,
    AdminPermission.MerchantsRead,
    AdminPermission.MerchantsManage,
  ],
};

/**
 * Role → country scope policy. Only country_manager and sales are restricted
 * to their assigned countries; all other roles operate globally.
 */
export const ADMIN_ROLE_SCOPE: Readonly<Record<AdminRole, AdminScope>> = {
  [AdminRole.SuperAdmin]: AdminScope.Global,
  [AdminRole.Admin]: AdminScope.Global,
  [AdminRole.CountryManager]: AdminScope.CountryScoped,
  [AdminRole.Sales]: AdminScope.CountryScoped,
  [AdminRole.Support]: AdminScope.Global,
  [AdminRole.Finance]: AdminScope.Global,
};

export function roleHasPermission(
  role: AdminRole | string | undefined | null,
  permission: AdminPermission,
): boolean {
  if (!role) return false;
  return ADMIN_ROLE_PERMISSIONS[role as AdminRole]?.includes(permission) ?? false;
}

export function roleScopePolicy(role: AdminRole | string | undefined | null): AdminScope {
  if (!role) return AdminScope.CountryScoped;
  return ADMIN_ROLE_SCOPE[role as AdminRole] ?? AdminScope.CountryScoped;
}

export function isCountryInScope(
  role: AdminRole | string | undefined | null,
  countryScope: readonly string[] | undefined | null,
  countryCode: string | null | undefined,
): boolean {
  if (roleScopePolicy(role) === AdminScope.Global) return true;
  if (!countryCode) return false;
  return countryScope?.includes(countryCode) ?? false;
}

// ── Canonical admin context (produced by auth-service introspection) ─────────

export interface AdminAuthContext {
  adminId: string;
  sessionId: string;
  role: AdminRole;
  countryScope: readonly string[];
  scope: AdminScope;
}

export interface AdminSessionIntrospectRequest {
  token: string;
}

export interface AdminSessionIntrospectResponse {
  adminId: string;
  sessionId: string;
  role: AdminRole;
  countryScope: readonly string[];
  scope: AdminScope;
}
