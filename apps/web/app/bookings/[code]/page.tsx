import { Suspense } from "react";
import BookingManageView from "./BookingManageView";

export default function BookingCodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin h-10 w-10 border-4 border-[#1D8D2B] border-t-transparent rounded-full" />
            <p className="text-slate-500 font-medium text-sm animate-pulse">
              Loading your booking details...
            </p>
          </div>
        </div>
      }
    >
      <BookingManageView />
    </Suspense>
  );
}
