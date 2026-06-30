import { Suspense, type ReactNode } from "react";
import { TravellerHeader } from "./components/TravellerHeader";

export default function TravellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <Suspense fallback={<div className="h-16 bg-white border-b border-slate-200" />}>
        <TravellerHeader />
      </Suspense>
      <main>{children}</main>
    </div>
  );
}
