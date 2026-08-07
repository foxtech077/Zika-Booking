"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-semibold tracking-[0.01em] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

    const variants = {
      primary:   "bg-green-700 text-white hover:bg-green-800 focus:ring-green-600 shadow-sm hover:shadow-md",
      secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-300",
      danger:    "bg-red-500 text-white hover:bg-red-600 focus:ring-red-400 shadow-sm",
      ghost:     "text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus:ring-slate-300",
      outline:   "border border-green-200 text-green-800 hover:bg-green-50 focus:ring-green-400 bg-white",
      success:   "bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-400 shadow-sm",
    };

    const sizes = {
      xs: "h-7 px-2.5 text-xs",
      sm: "h-8 px-3 text-xs",
      md: "h-9 px-4 text-sm",
      lg: "h-11 px-6 text-sm",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : icon ? (
          <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
