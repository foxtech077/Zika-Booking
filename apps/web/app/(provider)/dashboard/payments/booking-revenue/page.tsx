"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";

export default function BookingRevenuePage() {
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Booking Revenue Details</h1>
            <p className="mt-0.5 text-sm text-slate-500">This route is kept for compatibility, but no backend API powers it.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader title="Unavailable" icon={<Info />} subtitle="The current backend does not expose a booking revenue endpoint for provider payments." />
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          Booking revenue details are not available from the current API.
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/payments/payout-history">
            <Button variant="outline" icon={<BookOpen />}>
              View Payout History
            </Button>
          </Link>
          <Link href="/dashboard/bookings">
            <Button variant="ghost">
              View Bookings
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
