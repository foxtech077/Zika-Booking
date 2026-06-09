import { Suspense } from "react";
import { VerifyClient } from "./VerifyClient";

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-gray-500">Verifying...</div>}>
        <VerifyClient />
      </Suspense>
    </div>
  );
}
