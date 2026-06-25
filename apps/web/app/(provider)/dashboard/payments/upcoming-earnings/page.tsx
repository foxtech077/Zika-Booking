"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";

export default function UpcomingEarningsPage() {
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Provider Bookings</h1>
            <p className="mt-0.5 text-sm text-slate-500">Bookings are managed in the Provider Bookings module, not inside payments.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader title="Go to Bookings" icon={<BookOpen />} subtitle="Use the existing provider bookings page for booking management." />
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
          The payments module does not expose a separate upcoming earnings API.
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/bookings">
            <Button variant="outline" icon={<CalendarDays />}>
              View Bookings
            </Button>
          </Link>
          <Link href="/dashboard/payments/payout-history">
            <Button variant="ghost">
              View Payout History
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
