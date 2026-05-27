import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Skeleton";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS = {
  primary:   "bg-primary hover:bg-primary-dark text-white shadow-sm",
  secondary: "bg-white border border-border text-slate-700 hover:bg-slate-50 shadow-sm",
  danger:    "bg-danger hover:bg-red-600 text-white shadow-sm",
  ghost:     "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  outline:   "border border-primary text-primary hover:bg-primary/5",
};

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export function Button({
  loading,
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  fullWidth,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded-lg",
        "transition-all duration-150 cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" className="text-current opacity-80" />}
      {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
}
