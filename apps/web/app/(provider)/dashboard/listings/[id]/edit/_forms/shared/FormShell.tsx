"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

export interface FormStep {
  id: string;
  label: string;
  sublabel: string;
}

interface FormShellProps {
  steps: FormStep[];
  activeStep: string;
  status?: string;
  onStepClick: (id: string) => void;
  isComplete: (id: string) => boolean;
  isLocked: (id: string) => boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared wrapper for the listing‑edit pages.
 * - Left stepper occupies ~20‑22% of the width and stays sticky on desktop.
 * - Main content occupies the remaining space.
 * - Uses the olive‑green theme (Primary #556B2F) and Inter font globally.
 */
export function FormShell({
  steps,
  activeStep,
  status,
  onStepClick,
  isComplete,
  isLocked,
  children,
  footer,
}: FormShellProps) {
  const isSubmitted = status && !["draft", "rejected"].includes(status);
  const currentIndex = steps.findIndex((s) => s.id === activeStep);

  const done = isSubmitted ? steps.length : (currentIndex >= 0 ? currentIndex : 0);
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden h-full w-full max-w-[1600px] mx-auto min-h-0">
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sticky stepper – ~20% width on desktop */}
        <aside
          className="w-full max-w-[280px] lg:max-w-[320px] bg-[#F8F8F5] border-r border-border p-5 lg:p-6 overflow-y-auto shrink-0 hidden md:block"
          aria-label="Progress and steps"
        >
          {/* Progress card */}
          <Card
            padding="md"
            className="bg-white border border-[#556B2F]/15 text-[#3E4E22] shadow-sm relative overflow-hidden shrink-0 mb-6"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#EEF2E6]/30 rounded-full blur-3xl" />
            <div className="relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#556B2F]">
                Progress
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-[#3E4E22]">{pct}%</span>
                <span className="text-xs text-[#556B2F] font-medium">
                  {done} / {steps.length}
                </span>
              </div>
              <div className="w-full bg-[#EEF2E6] rounded-full h-2 mt-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#556B2F] to-[#3E4E22] h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Steps navigation */}
          <Card padding="none" className="py-2 border border-[#556B2F]/10 shadow-sm bg-white">
            {steps.map((step, idx) => {
              const locked = isLocked(step.id);
              const isPast = idx < currentIndex;
              const complete = isPast && isComplete(step.id);
              const active = activeStep === step.id;

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={locked}
                  onClick={() => !locked && onStepClick(step.id)}
                  className={cn(
                    "w-full text-left flex items-start gap-3.5 px-4 py-3.5 border-l-2 transition-all group relative",
                    active ? "border-[#556B2F] bg-[#EEF2E6]/40" : "border-transparent",
                    !locked && !active ? "hover:bg-slate-50/80 cursor-pointer" : "",
                    locked ? "opacity-50 cursor-not-allowed bg-slate-50/10" : ""
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all",
                      active
                        ? "border-[#556B2F] bg-[#556B2F] text-white shadow-[0_0_12px_rgba(76,106,72,0.2)] scale-105"
                        : complete
                          ? "border-[#556B2F] bg-[#EEF2E6] text-[#556B2F]"
                          : !locked
                            ? "border-slate-300 bg-white text-slate-500 group-hover:border-slate-400"
                            : "border-slate-200 bg-slate-100 text-slate-400"
                    )}
                  >
                    {complete && !active ? (
                      <span className="text-[10px] font-bold">✓</span>
                    ) : (
                      <span className="text-xs font-bold">{idx + 1}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-xs font-bold truncate",
                        active ? "text-[#3E4E22]" : complete ? "text-[#556B2F]" : "text-slate-700"
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-normal break-words pr-4">
                      {step.sublabel}
                    </p>
                  </div>

                  {locked && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-300">
                      🔒
                    </span>
                  )}
                </button>
              );
            })}
          </Card>
        </aside>

        {/* Main form area */}
        <section className="flex-1 overflow-y-auto bg-[#FAFBF9] p-6 lg:p-8 min-h-0">
          <div className="max-w-4xl mx-auto w-full">
            {children}
          </div>
        </section>
      </div>

      {/* Footer */}
      {footer && (
        <div className="bg-white border-t border-border px-6 py-4 shrink-0 z-10">
          {footer}
        </div>
      )}
    </div>
  );
}
