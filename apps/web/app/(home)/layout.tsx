import { Suspense, type ReactNode } from "react";
import { TravellerHeader } from "../traveller/components/TravellerHeader";

// Route group: the folder name is not part of the URL, so this layout applies
// to "/" only. Keeping it scoped here rather than in the root layout stops the
// traveller header leaking onto /auth, /dashboard and the booking flow.
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <Suspense fallback={<div className="h-16 bg-white border-b border-slate-200" />}>
        <TravellerHeader />
      </Suspense>
      {/* Not <main>: the page below renders its own <main>, and nesting two is
          invalid HTML that leaves screen readers with two page landmarks. */}
      <div>{children}</div>
    </div>
  );
}
