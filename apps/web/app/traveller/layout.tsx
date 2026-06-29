import type { ReactNode } from "react";
import { TravellerHeader } from "./components/TravellerHeader";

export default function TravellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <TravellerHeader />
      <main>{children}</main>
    </div>
  );
}
