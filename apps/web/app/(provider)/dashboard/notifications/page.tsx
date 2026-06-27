"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Mail,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatDate } from "@/lib/utils";

const COUNTRY_OPTIONS = [
  { value: "all", label: "All markets" },
  { value: "KE", label: "Kenya" },
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "ZA", label: "South Africa" },
  { value: "UG", label: "Uganda" },
  { value: "TZ", label: "Tanzania" },
];

const BATCH_OPTIONS = [
  { value: "100", label: "100 emails / batch" },
  { value: "250", label: "250 emails / batch" },
  { value: "500", label: "500 emails / batch" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function readRate(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export default function NotificationsPage() {
  const [notifyProviders, setNotifyProviders] = useState(true);
  const [country, setCountry] = useState("all");
  const [currentRate, setCurrentRate] = useState("5");
  const [newRate, setNewRate] = useState("7.5");
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [adminReason, setAdminReason] = useState("Commission policy update for upcoming confirmed bookings.");
  const [batchSize, setBatchSize] = useState("250");
  const [prepared, setPrepared] = useState(false);

  const marketLabel = COUNTRY_OPTIONS.find((item) => item.value === country)?.label ?? "All markets";
  const subject = `Important: ZikaBooking commission rate update for ${marketLabel}`;
  const providerDashboardLink = "/dashboard/earnings";
  const current = readRate(currentRate);
  const next = readRate(newRate);
  const hasValidRates = current >= 0 && next >= 0 && currentRate.trim() !== "" && newRate.trim() !== "";
  const isReady = notifyProviders && hasValidRates && Boolean(effectiveDate) && adminReason.trim().length >= 10;

  const requirementChecks = useMemo(
    () => [
      { label: "Notify providers is ON", complete: notifyProviders },
      { label: "Affected country or all markets selected", complete: Boolean(country) },
      { label: "Current and new rates are provided", complete: hasValidRates },
      { label: "Effective date is set", complete: Boolean(effectiveDate) },
      { label: "Admin reason is ready for the email body", complete: adminReason.trim().length >= 10 },
      { label: "Email includes provider dashboard earnings link", complete: true },
      { label: "Existing confirmed bookings note is included", complete: true },
      { label: "Batched delivery setting is selected", complete: Boolean(batchSize) },
    ],
    [adminReason, batchSize, country, effectiveDate, hasValidRates, notifyProviders]
  );

  const completedChecks = requirementChecks.filter((item) => item.complete).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Provider Notifications"
        subtitle="Prepare commission rate update emails for affected providers. API delivery can be connected later."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={providerDashboardLink}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-green-200 bg-white px-4 text-sm font-semibold text-green-800 transition-colors hover:bg-green-50"
            >
              <ExternalLink className="h-4 w-4" />
              Earnings dashboard
            </Link>
            <Button
              icon={<Send />}
              disabled={!isReady}
              onClick={() => setPrepared(true)}
            >
              Prepare notification
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatusCard label="Delivery mode" value={notifyProviders ? "Enabled" : "Paused"} icon={<BellRing />} tone={notifyProviders ? "success" : "muted"} />
        <StatusCard label="Target market" value={marketLabel} icon={<ShieldCheck />} tone="neutral" />
        <StatusCard label="Send window" value="Within 1 hour" icon={<Clock3 />} tone="neutral" />
        <StatusCard label="Readiness" value={`${completedChecks}/${requirementChecks.length}`} icon={<CheckCircle2 />} tone={isReady ? "success" : "warning"} />
      </div>

      {prepared && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Notification payload is prepared locally. Connect the future notification API to send this via SendGrid in batches of {batchSize}.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <div className="mb-5 flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-slate-950">Commission Update Email</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-slate-900">Notify providers</span>
                <span className="block text-xs text-slate-500">When enabled, this update is eligible for SendGrid delivery.</span>
              </span>
              <input
                type="checkbox"
                checked={notifyProviders}
                onChange={(event) => setNotifyProviders(event.target.checked)}
                className="h-5 w-5 accent-primary"
              />
            </label>

            <Select
              label="Affected country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              options={COUNTRY_OPTIONS}
            />

            <Input
              label="Current commission rate (%)"
              type="number"
              min="0"
              step="0.1"
              value={currentRate}
              onChange={(event) => setCurrentRate(event.target.value)}
            />

            <Input
              label="New commission rate (%)"
              type="number"
              min="0"
              step="0.1"
              value={newRate}
              onChange={(event) => setNewRate(event.target.value)}
            />

            <Input
              label="Effective date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />

            <Select
              label="SendGrid batch size"
              value={batchSize}
              onChange={(event) => setBatchSize(event.target.value)}
              options={BATCH_OPTIONS}
            />
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Admin reason</span>
            <textarea
              value={adminReason}
              onChange={(event) => setAdminReason(event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Explain why this commission rate is changing."
            />
          </label>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-950">Email Preview</h3>
              <p className="mt-1 text-xs text-slate-500">Matches requirement 15.8.</p>
            </div>
            <Badge label={notifyProviders ? "Notify ON" : "Notify OFF"} status={notifyProviders ? "confirmed" : "pending"} />
          </div>

          <div className="rounded-xl border border-border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Subject</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{subject}</p>
          </div>

          <div className="mt-4 space-y-3 rounded-xl border border-border p-4 text-sm text-slate-700">
            <PreviewRow label="Current rate" value={`${currentRate || "0"}%`} />
            <PreviewRow label="New rate" value={`${newRate || "0"}%`} />
            <PreviewRow label="Effective date" value={effectiveDate ? formatDate(effectiveDate) : "Not set"} />
            <PreviewRow label="Admin reason" value={adminReason || "Not provided"} />
            <PreviewRow
              label="Dashboard link"
              value={<Link href={providerDashboardLink} className="font-semibold text-primary hover:underline">Provider dashboard earnings</Link>}
            />
            <div className="rounded-lg bg-amber-50 p-3 text-amber-800">
              This change applies to new bookings confirmed on or after {effectiveDate ? formatDate(effectiveDate) : "[effective date]"}. Your existing confirmed bookings are not affected.
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-slate-950">Delivery Readiness</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {requirementChecks.map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", item.complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                {item.complete ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              </span>
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatusCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "success" | "warning" | "neutral" | "muted";
}) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    neutral: "bg-primary-50 text-primary",
    muted: "bg-slate-100 text-slate-500",
  };

  return (
    <Card className="min-h-[112px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5", styles[tone])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[130px_1fr]">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}
