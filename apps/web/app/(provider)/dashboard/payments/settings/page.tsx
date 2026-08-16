"use client";

import { PaymentSettingsForm } from "@/components/payments/PaymentSettingsForm";

export default function PaymentSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      <PaymentSettingsForm showBackButton />
    </div>
  );
}
