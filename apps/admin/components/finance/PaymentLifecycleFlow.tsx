"use client";

import { cn } from "@/lib/utils";
import { 
  CalendarPlus, CreditCard, BadgeCheck, Home, 
  Clock, Percent, Landmark, ArrowRight 
} from "lucide-react";

interface Step {
  number: number;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  actor: "Traveller" | "Platform" | "Provider";
}

const LIFECYCLE_STEPS: Step[] = [
  {
    number: 1,
    label: "Booking Created",
    description: "Traveller selects dates and submits booking request.",
    icon: CalendarPlus,
    actor: "Traveller",
  },
  {
    number: 2,
    label: "Payment Received",
    description: "Funds authorized and captured in platform escrow account.",
    icon: CreditCard,
    actor: "Traveller",
  },
  {
    number: 3,
    label: "Booking Confirmed",
    description: "Booking state set to Confirmed; calendar slots locked.",
    icon: BadgeCheck,
    actor: "Platform",
  },
  {
    number: 4,
    label: "Check-In Completed",
    description: "Traveller arrives and checks in to the property/vehicle.",
    icon: Home,
    actor: "Platform",
  },
  {
    number: 5,
    label: "T+24 Hold Period",
    description: "Payout held for 24 hours post check-in to handle disputes.",
    icon: Clock,
    actor: "Platform",
  },
  {
    number: 6,
    label: "Commission Deducted",
    description: "Zika deducts the global/country commission from checkout total.",
    icon: Percent,
    actor: "Platform",
  },
  {
    number: 7,
    label: "Provider Paid",
    description: "Settlement amount transferred to Provider bank/Stripe account.",
    icon: Landmark,
    actor: "Provider",
  },
];

interface PaymentLifecycleFlowProps {
  activeStep?: number; // 1 to 7
  className?: string;
}

export function PaymentLifecycleFlow({ activeStep = 0, className }: PaymentLifecycleFlowProps) {
  return (
    <div className={cn("bg-white border border-border rounded-xl p-5 md:p-6 shadow-sm", className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Payment & Payout Lifecycle</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational visualization of funds flow from booking request to provider settlement.
          </p>
        </div>
        
        {/* Simplified Flow Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">Traveller</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-100">Platform Escrow</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">Provider Payout</span>
        </div>
      </div>

      {/* Steps track */}
      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 lg:gap-2">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isCompleted = step.number < activeStep;
            const isActive = step.number === activeStep;
            const isPending = step.number > activeStep;

            let badgeColor = "bg-slate-100 text-slate-500 border-slate-200";
            if (isCompleted) {
              badgeColor = "bg-success-light text-success-dark border-success/20";
            } else if (isActive) {
              badgeColor = "bg-primary/10 text-primary border-primary/20 animate-pulse";
            }

            let actorBadge = "";
            if (step.actor === "Traveller") {
              actorBadge = "bg-blue-50 text-blue-600 border-blue-100";
            } else if (step.actor === "Platform") {
              actorBadge = "bg-purple-50 text-purple-600 border-purple-100";
            } else {
              actorBadge = "bg-emerald-50 text-emerald-600 border-emerald-100";
            }

            return (
              <div 
                key={step.number} 
                className={cn(
                  "flex flex-col p-3 rounded-lg border transition-all duration-200",
                  isActive && "bg-slate-50/50 border-primary shadow-sm",
                  isCompleted && "bg-success/[0.01] border-slate-200",
                  isPending && "bg-transparent border-slate-100 opacity-60 hover:opacity-100"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-medium", badgeColor)}>
                    <StepIcon className="h-4 w-4" />
                  </div>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider", actorBadge)}>
                    {step.actor}
                  </span>
                </div>
                
                <h5 className="text-xs font-semibold text-slate-900 leading-tight">
                  {step.number}. {step.label}
                </h5>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
