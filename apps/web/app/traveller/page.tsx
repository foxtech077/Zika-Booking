import { Suspense } from "react";
import TravellerDashboard from "./TravellerPageClient";
import LoadingSpinner from "./components/LoadingSpinner";

export default function TravellerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <TravellerDashboard />
    </Suspense>
  );
}
