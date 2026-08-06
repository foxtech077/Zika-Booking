"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, AlertCircle, Server, Key } from "lucide-react";
import { canAccess } from "@/permissions/rbac";
import { startRegistration } from "@simplewebauthn/browser";
import { api } from "@/lib/api";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/auth";
import { formatRelativeTime } from "@/lib/utils";
import { SYSTEM_COUNTRIES } from "@/lib/countries";

const checkHealth = (client: any, label: string) =>
  client.get("/health").then(() => ({ service: label, status: "healthy" })).catch(() => ({ service: label, status: "degraded" }));

export default function SettingsPage() {
  const { user } = useAuthStore();
  // Global platform sections are super_admin only
  const isGlobalAdmin = canAccess(user?.role, "manage_settings");
  const [registeringKey, setRegisteringKey] = useState(false);
  const isCountryScoped = user?.role === "country_manager" || user?.role === "sales";
  const userCountries = user?.countryScope ?? [];

  const handleRegisterPasskey = async () => {
    try {
      setRegisteringKey(true);
      const { data: optionsRes } = await api.post("/admin/auth/webauthn/register");
      const options = optionsRes.data ?? optionsRes;

      const attResp = await startRegistration(options);

      await api.post("/admin/auth/webauthn/register/complete", attResp);

      alert("Passkey registered successfully!");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error?.message || "Failed to register passkey");
    } finally {
      setRegisteringKey(false);
    }
  };

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

  const services = [
    { ...(authHealth ?? { service: "Auth Service", status: "checking" }), port: 3001, description: "Authentication, sessions, admin users, audit logs" },
    { ...(listingHealth ?? { service: "Listing Service", status: "checking" }), port: 3003, description: "Listings, bookings, commission, vouchers, reviews" },
  ];

  const SESSION_SETTINGS = [
    { label: "TOTP 2FA", value: user?.totpEnabled ? "Enabled" : "Disabled", ok: user?.totpEnabled },
    { label: "Session Type", value: "JWT Bearer Token" },
    { label: "Session Storage", value: "sessionStorage (browser)" },
    { label: "Current Role", value: user?.role ? user.role.replace(/_/g, " ") : "—" },
    {
      label: "Country Scope",
      value: (user?.role !== "country_manager" && user?.role !== "sales")
        ? "Global"
        : user?.countryScope?.join(", ") || "Global"
    },
  ];

  const PLATFORM_FEATURES = [
    { feature: "iCal Channel Sync", description: "15-minute auto-sync of external calendars", status: "enabled" },
    { feature: "Rate Limiting", description: "200 req/min per IP across all services", status: "enabled" },
    { feature: "Booking Auto-Cancel", description: "Auto-cancel unpaid bookings after timeout", status: "enabled" },
    { feature: "Review Moderation", description: "Manual review hide/unhide controls", status: "enabled" },
    { feature: "Commission Override", description: "Per-country commission rate management", status: "enabled" },
    { feature: "Voucher System", description: "Percentage and fixed-amount vouchers", status: "enabled" },
    { feature: "Audit Trail", description: "Immutable audit log for all admin actions", status: "enabled" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader
        title="Settings"
        description="Platform configuration and system status"
      />

      {/* Service health */}
      <Card padding="none">
        <div className="p-5 border-b border-border">
          <CardHeader title="Service Health" description="Live status of backend microservices" />
        </div>
        <div className="divide-y divide-border">
          {services.map((svc) => (
            <div key={svc.service} className="flex items-center gap-4 px-5 py-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${svc.status === "healthy" ? "bg-success/10" :
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
                <p className="text-xs text-slate-500">Port {svc.port} · {svc.description}</p>
              </div>
              <Badge
                label={svc.status === "checking" ? "Checking…" : svc.status === "healthy" ? "Healthy" : "Degraded"}
                status={svc.status === "healthy" ? "active" : svc.status === "degraded" ? "rejected" : "pending_review"}
              />
            </div>
          ))}
        </div>
      </Card>

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

      {/* Assigned Countries */}
      {isCountryScoped && (
        <Card padding="none">
          <div className="p-5 border-b border-border">
            <CardHeader title="Assigned Countries" description="Countries mapped to your manager account for moderation and approval scopes" />
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userCountries.map((code) => {
              const found = SYSTEM_COUNTRIES.find((sc) => sc.code === code);
              return (
                <div key={code} className="flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-xl">
                  <span className="text-2xl">{found?.flag ?? "🌍"}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{found?.name ?? code}</p>
                    <p className="text-xs text-slate-500 font-mono">{code.toUpperCase()}</p>
                  </div>
                </div>
              );
            })}
            {userCountries.length === 0 && (
              <p className="text-sm text-slate-500 col-span-2">No countries assigned to your account.</p>
            )}
          </div>
        </Card>
      )}

      {/* Security */}
      <Card padding="none">
        <div className="p-5 border-b border-border">
          <CardHeader title="Security" description="Manage your authentication methods" />
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Hardware Security Keys & Passkeys
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Register a hardware key or device passkey for secure and fast login.
            </p>
          </div>
          <Button onClick={handleRegisterPasskey} loading={registeringKey} variant="secondary">
            Register Passkey
          </Button>
        </div>
      </Card>

      {/* Environment info */}
      <Card>
        <CardHeader title="Environment" description="Runtime configuration" />
        <div className="mt-4 space-y-2 text-sm">
          {[
            ["Node Environment", "development"],
            ["Admin Port", "3002"],
            ["Auth Service", "api.kainook.com/auth"],
            ["Listing Service", "api.kainook.com/listings"],
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
    </div>
  );
}
