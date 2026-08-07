"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";

export default function PayoutReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/payments">
            <Button variant="ghost" size="sm" icon={<ArrowLeft />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payout Reports</h1>
            <p className="mt-0.5 text-sm text-slate-500">This legacy route no longer shows fake revenue data.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader title="Unavailable" icon={<FileText />} subtitle="No backend report endpoint is available for provider payment reports." />
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
          Payout reports are not available from the current API.
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/payments/payout-history">
            <Button variant="outline">
              View Payout History
            </Button>
          </Link>
          <Link href="/dashboard/payments/settings">
            <Button variant="ghost">
              Open Payment Settings
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
