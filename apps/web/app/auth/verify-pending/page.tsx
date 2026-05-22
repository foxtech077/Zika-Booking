import { Suspense } from "react";
import { VerifyPendingClient } from "./VerifyPendingClient";

export default function VerifyPendingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
        <VerifyPendingClient />
      </Suspense>
    </div>
  );
}
