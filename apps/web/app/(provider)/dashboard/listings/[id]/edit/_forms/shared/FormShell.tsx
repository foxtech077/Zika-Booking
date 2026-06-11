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
}

export function FormShell({
  steps, activeStep, status, onStepClick, isComplete, isLocked, children,
}: FormShellProps) {
  const isSubmitted = status && !["draft", "rejected"].includes(status);
  const currentIndex = steps.findIndex((s) => s.id === activeStep);

  const done = isSubmitted ? steps.length : (currentIndex >= 0 ? currentIndex : 0);
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 items-start">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-4 sticky top-[72px] h-fit shadow-md">
        <Card padding="md" className="bg-[#F8F8F5] border border-[#556B2F]/20 text-[#3E4E22] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#EEF2E6]/30 rounded-full blur-3xl" />
          <div className="relative z-10">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#556B2F]">Progress</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-[#3E4E22]">{pct}%</span>
              <span className="text-xs text-[#556B2F] font-medium">{done} / {steps.length}</span>
            </div>
            <div className="w-full bg-[#EEF2E6] rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#556B2F] to-[#3E4E22] h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </Card>

        <Card padding="none" className="py-2 border border-border shadow-sm bg-[#F8F8F5]">
          {steps.map((step, idx) => {
            const locked   = isLocked(step.id);
            // A step shows ✓ ONLY if it's strictly BEHIND the active step AND passes validation.
            // Steps at or ahead of the active step always show their number,
            // even if isComplete() returns true due to default values.
            const isPast     = idx < currentIndex;
            const complete   = isPast && isComplete(step.id);
            const active     = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                disabled={locked}
                onClick={() => !locked && onStepClick(step.id)}
                className={cn(
                  "w-full text-left flex items-start gap-3.5 px-4 py-3.5 border-l-2 transition-all duration-200 group relative",
                  active  ? "border-[#556B2F] bg-[#EEF2E6]/40" : "border-transparent",
                  !locked && !active ? "hover:bg-slate-50/80 cursor-pointer" : "",
                  locked  ? "opacity-50 cursor-not-allowed bg-slate-50/10" : "",
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all",
                  active    ? "border-[#556B2F] bg-[#556B2F] text-white shadow-[0_0_12px_rgba(76,106,72,0.2)] scale-105"
                    : complete ? "border-[#556B2F] bg-[#EEF2E6] text-[#556B2F]"
                    : !locked  ? "border-slate-300 bg-white text-slate-500 group-hover:border-slate-400"
                    :            "border-slate-200 bg-slate-100 text-slate-400",
                )}>
                  {/* Always show the number when active or ahead; show ✓ only for past+complete steps */}
                  {complete && !active
                    ? <span className="text-[10px] font-bold">✓</span>
                    : <span className="text-xs font-bold">{idx + 1}</span>}
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "text-xs font-bold",
                    active    ? "text-[#3E4E22]"
                    : complete ? "text-[#556B2F]"
                    :            "text-slate-700",
                  )}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{step.sublabel}</p>
                </div>
                {locked && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-300">🔒</span>
                )}
              </button>
            );
          })}
        </Card>
      </div>

      {/* Content */}
              <div className="lg:col-span-4">
        {children}
      </div>
    </div>
  );
}
