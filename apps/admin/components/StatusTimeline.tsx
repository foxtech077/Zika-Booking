import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusTimelineProps {
  currentStatus: string;
}

const STEPS = [
  { label: "Draft", value: "draft" },
  { label: "Pending Payment", value: "pending_payment" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Checked In", value: "checked_in" },
  { label: "Completed", value: "completed" },
];

export function StatusTimeline({ currentStatus }: StatusTimelineProps) {
  const currentIndex = STEPS.findIndex((s) => s.value === currentStatus);
  const activeIndex = currentIndex === -1 ? STEPS.length : currentIndex;

  return (
    <div className="flex items-center justify-between w-full relative mb-8">
      <div className="absolute left-3 right-3 top-3 h-0.5 bg-slate-200 z-0"></div>
      <div
        className="absolute left-3 top-3 h-0.5 bg-primary z-0 transition-all duration-300"
        style={{ width: `calc(${(Math.min(activeIndex, STEPS.length - 1) / (STEPS.length - 1)) * 100}% - 24px)` }}
      />
      {STEPS.map((step, index) => {
        const isCompleted = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <div key={step.value} className="relative z-10 flex flex-col items-center">
            <div
              className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 bg-white",
                isCompleted
                  ? "bg-primary text-primary-foreground border-2 border-primary"
                  : isActive
                  ? "border-2 border-primary text-primary ring-4 ring-primary/20"
                  : "border-2 border-slate-300 text-slate-400"
              )}
            >
              {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider absolute top-8 whitespace-nowrap text-center",
                isActive ? "text-primary font-bold" : "text-slate-500"
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
