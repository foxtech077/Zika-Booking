import { Suspense } from "react";
import CategoryListingsClient from "../components/CategoryListingsClient";

export const metadata = { title: "Home — Kainook" };

export default function ApartmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-4 border-[#1D8D2B] border-t-transparent rounded-full" />
        </div>
      }
    >
      <CategoryListingsClient category="apartment" />
    </Suspense>
  );
}
