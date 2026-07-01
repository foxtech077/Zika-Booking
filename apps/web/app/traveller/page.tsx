import { Suspense } from "react";
import TravellerDashboard from "./TravellerPageClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <TravellerDashboard />
    </Suspense>
  );
}
