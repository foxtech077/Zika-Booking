import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-gray-500 text-sm">Verifying…</div>}>
        <VerifyEmailClient />
      </Suspense>
    </div>
  );
}
