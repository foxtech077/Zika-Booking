"use client";

import { useQuery } from "@tanstack/react-query";
import { Settings, CheckCircle, AlertCircle, Server } from "lucide-react";
import { api } from "@/lib/api";
import { listingApi } from "@/lib/listing-api";
import { paymentApi } from "@/lib/payment-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";
import { formatRelativeTime } from "@/lib/utils";

const checkHealth = (client: any, label: string) =>
  client.get("/health").then(() => ({ service: label, status: "healthy" })).catch(() => ({ service: label, status: "degraded" }));

export default function SettingsPage() {
  const { user } = useAuthStore();
  // Global platform sections are super_admin only
  const isGlobalAdmin = canAccess(user?.role, "manage_settings");

  const { data: authHealth } = useQuery({
    queryKey: ["health-auth"],
    queryFn: () => checkHealth(api, "Auth Service"),
    refetchInterval: 30_000,
  });

  const { data: listingHealth } = useQuery({
    queryKey: ["health-listing"],
    queryFn: () => checkHealth(listingApi, "Listing Service"),
    refetchInterval: 30_000,
  });

  const { data: paymentHealth } = useQuery({
    queryKey: ["health-payment"],
    queryFn: () => checkHealth(paymentApi, "Payment Service"),
    refetchInterval: 30_000,
  });

  const services = [
    { ...(authHealth ?? { service: "Auth Service", status: "checking" }), endpoint: "https://api.kainook.com/auth", description: "Authentication, sessions, admin users, audit logs" },
    { ...(listingHealth ?? { service: "Listing Service", status: "checking" }), endpoint: "https://api.kainook.com/listings", description: "Listings, bookings, commission, vouchers, reviews" },
    { ...(paymentHealth ?? { service: "Payment Service", status: "checking" }), endpoint: "https://api.kainook.com/payments", description: "Payments, saved methods, payment status" },
  ];

  const SESSION_SETTINGS = [
    { label: "TOTP 2FA", value: user?.totpEnabled ? "Enabled" : "Disabled", ok: user?.totpEnabled },
    { label: "Session Type", value: "JWT Bearer Token" },
    { label: "Session Storage", value: "sessionStorage (browser)" },
    { label: "Current Role", value: user?.role ? user.role.replace(/_/g, " ") : "—" },
    { label: "Country Scope", value: user?.countryScope?.join(", ") || "Global" },
  ];

  const PLATFORM_FEATURES = [
    { feature: "iCal Channel Sync", description: "15-minute auto-sync of external calendars", status: "enabled" },
    { feature: "Rate Limiting", description: "200 req/min per IP across all services", status: "enabled" },
    { feature: "Booking Auto-Cancel", description: "Auto-cancel unpaid bookings after timeout", status: "enabled" },
    { feature: "Review Moderation", description: "Manual review hide/unhide controls", status: "enabled" },
    { feature: "Commission Override", description: "Per-country commission rate management", status: "enabled" },
    { feature: "SLA Enforcement", description: "48-hour accreditation review SLA", status: "enabled" },
    { feature: "Voucher System", description: "Percentage and fixed-amount vouchers", status: "enabled" },
    { feature: "Audit Trail", description: "Immutable audit log for all admin actions", status: "enabled" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader
        title="Settings"
        description="Platform configuration and system status"
      />

      {/* Service health — super_admin only */}
      {isGlobalAdmin && (
        <Card padding="none">
          <div className="p-5 border-b border-border">
            <CardHeader title="Service Health" description="Live status of backend microservices" />
          </div>
          <div className="divide-y divide-border">
            {services.map((svc) => (
              <div key={svc.service} className="flex items-center gap-4 px-5 py-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  svc.status === "healthy" ? "bg-success/10" :
                  svc.status === "degraded" ? "bg-danger/10" : "bg-slate-100"
                }`}>
                  {svc.status === "healthy" ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : svc.status === "degraded" ? (
                    <AlertCircle className="h-4 w-4 text-danger" />
                  ) : (
                    <Server className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{svc.service}</p>
                  <p className="text-xs text-slate-500">{svc.endpoint} - {svc.description}</p>
                </div>
                <Badge
                  label={svc.status === "checking" ? "Checking…" : svc.status === "healthy" ? "Healthy" : "Degraded"}
                  status={svc.status === "healthy" ? "active" : svc.status === "degraded" ? "rejected" : "pending_review"}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Current session */}
      <Card padding="none">
        <div className="p-5 border-b border-border">
          <CardHeader title="Your Session" description={`Signed in as ${user?.email}`} />
        </div>
        <div className="divide-y divide-border">
          {SESSION_SETTINGS.map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-600">{label}</span>
              <div className="flex items-center gap-2">
                {ok !== undefined && (
                  <div className={`h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-warning"}`} />
                )}
                <span className="text-sm font-medium text-slate-900 capitalize">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Platform features — super_admin only */}
      {isGlobalAdmin && (
        <Card padding="none">
          <div className="p-5 border-b border-border">
            <CardHeader title="Platform Features" description="Core features and their current status" />
          </div>
          <div className="divide-y divide-border">
            {PLATFORM_FEATURES.map(({ feature, description, status }) => (
              <div key={feature} className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{feature}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
                <div className="flex-shrink-0">
                  <Badge label="Enabled" status="active" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Environment info — super_admin only */}
      {isGlobalAdmin && (
        <Card>
          <CardHeader title="Environment" description="Runtime configuration" />
          <div className="mt-4 space-y-2 text-sm">
            {[
              ["Node Environment", "development"],
              ["Admin Port", "3002"],
              ["Main Website", "https://kainook.com"],
              ["Admin Portal", "https://admin.kainook.com"],
              ["Provider Portal", "https://provider.kainook.com"],
              ["API Gateway", "https://api.kainook.com"],
              ["Auth Service", "https://api.kainook.com/auth"],
              ["Listing Service", "https://api.kainook.com/listings"],
              ["Payment Service", "https://api.kainook.com/payments"],
              ["Next.js Version", "14.2.21"],
              ["React Version", "18.3.1"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-slate-500">{k}</span>
                <span className="font-mono text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded">{v}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
