import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ loading, variant = "primary", children, disabled, className = "", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-primary hover:bg-primary-dark text-white",
    secondary: "bg-white border border-primary text-primary hover:bg-primary/5",
    ghost: "text-primary hover:underline",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-base transition disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
