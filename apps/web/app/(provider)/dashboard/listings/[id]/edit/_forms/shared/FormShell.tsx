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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        <Card padding="md" className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300">Progress</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black">{pct}%</span>
              <span className="text-xs text-indigo-200 font-medium">{done} / {steps.length}</span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </Card>

        <Card padding="none" className="py-2 border border-border shadow-sm">
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
                  active  ? "border-primary bg-primary-50" : "border-transparent",
                  !locked && !active ? "hover:bg-slate-50 cursor-pointer" : "",
                  locked  ? "opacity-50 cursor-not-allowed bg-slate-50/50" : "",
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all",
                  active    ? "border-primary bg-primary text-white shadow-glow-primary scale-105"
                  : complete ? "border-emerald-500 bg-emerald-50 text-emerald-600"
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
                    active    ? "text-primary-800"
                    : complete ? "text-emerald-800"
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
      <div className="lg:col-span-3">
        {children}
      </div>
    </div>
  );
}
