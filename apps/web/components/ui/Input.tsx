"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 [&>svg]:w-4 [&>svg]:h-4">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-10 rounded-xl border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400",
              "transition-all duration-150 outline-none",
              "focus:ring-2 focus:ring-green-500/20 focus:ring-offset-0 focus:border-green-500",
              error
                ? "border-red-400 focus:ring-red-400/20 focus:border-red-400"
                : "border-slate-200 hover:border-green-300",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 [&>svg]:w-4 [&>svg]:h-4">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400",
            "transition-all duration-150 outline-none resize-none",
            "focus:ring-2 focus:ring-green-500/20 focus:border-green-500",
            error
              ? "border-red-400 focus:ring-red-400/20"
              : "border-slate-200 hover:border-green-300",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const currentValue = String(props.value ?? "");
    const needsPlaceholder = Boolean(placeholder) && !options.some((option) => option.value === currentValue);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "w-full h-10 rounded-xl border bg-white px-3 text-sm text-slate-900",
            "transition-all duration-150 outline-none",
            "focus:ring-2 focus:ring-green-500/20 focus:border-green-500",
            error ? "border-red-400" : "border-slate-200 hover:border-green-300",
            className
          )}
          {...props}
        >
          {needsPlaceholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Input, Textarea, Select };
