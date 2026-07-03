import { useState, useRef, useEffect } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import { createPortal } from "react-dom";

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Input({
  label, error, hint, leftIcon, rightIcon, className, id, ...props
}: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          id={id}
          className={cn(
            "block w-full rounded-lg border bg-white text-sm text-slate-900 placeholder:text-slate-400",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
            error
              ? "border-danger focus:border-danger focus:ring-danger/25"
              : "border-border hover:border-slate-400",
            leftIcon ? "pl-9" : "pl-3",
            rightIcon ? "pr-9" : "pr-3",
            "py-2",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
          "transition-colors duration-150 resize-none",
          "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
          "disabled:cursor-not-allowed disabled:bg-slate-50",
          error
            ? "border-danger focus:border-danger focus:ring-danger/25"
            : "border-border hover:border-slate-400",
          className
        )}
        rows={props.rows ?? 3}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label, error, hint, options, placeholder, className, id, ...props
}: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 appearance-none",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
          "disabled:cursor-not-allowed disabled:bg-slate-50",
          error
            ? "border-danger focus:border-danger focus:ring-danger/25"
            : "border-border hover:border-slate-400",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  label: string;
  options: DropdownOption[];
  value: string | string[];
  onChange: (value: any) => void;
  isMulti?: boolean;
  placeholder?: string;
  id?: string;
  required?: boolean;
  variant?: "primary" | "blue";
  disabled?: boolean;
}

export function CustomDropdown({
  label,
  options,
  value,
  onChange,
  isMulti = false,
  placeholder = "Select...",
  id,
  required,
  variant = "primary",
  disabled = false,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const portalMenu = document.getElementById("custom-dropdown-portal-menu");
        if (portalMenu && portalMenu.contains(e.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
    setSearch("");
  };

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const updateCoords = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.value.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (val: string) => {
    if (isMulti) {
      return Array.isArray(value) && value.includes(val);
    }
    return value === val;
  };

  const handleSelect = (val: string) => {
    if (isMulti) {
      const current = Array.isArray(value) ? value : [];
      const next = current.includes(val)
        ? current.filter((v) => v !== val)
        : [...current, val];
      onChange(next);
    } else {
      onChange(val);
      setIsOpen(false);
    }
  };

  const displayValue = () => {
    if (isMulti) {
      const current = Array.isArray(value) ? value : [];
      if (current.length === 0) return placeholder;
      if (current.length <= 2) {
        return options
          .filter((o) => current.includes(o.value))
          .map((o) => {
            const firstWord = o.label.split(" ")[0];
            return firstWord + (o.value && o.value !== "all" ? " " + o.value : "");
          })
          .join(", ");
      }
      return `${current.length} selected`;
    } else {
      const found = options.find((o) => o.value === value);
      return found ? found.label : placeholder;
    }
  };

  const menuContent = isOpen && (
    <div
      id="custom-dropdown-portal-menu"
      className="absolute rounded-lg border border-border bg-white shadow-lg z-[9999] p-2 space-y-1.5 max-h-[260px] overflow-y-auto"
      style={{
        position: "absolute",
        top: `${menuCoords.top}px`,
        left: `${menuCoords.left}px`,
        width: `${menuCoords.width}px`,
      }}
    >
      {options.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-border rounded focus:outline-none focus:ring-1",
              variant === "blue"
                ? "focus:ring-blue-500 focus:border-blue-500"
                : "focus:ring-primary focus:border-primary"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className="overflow-y-auto max-h-[180px] space-y-0.5">
        {filteredOptions.map((o) => {
          const selected = isSelected(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => handleSelect(o.value)}
              className={cn(
                "w-full text-left px-2.5 py-2 text-xs rounded hover:bg-slate-100 transition-colors flex items-center justify-between",
                selected
                  ? variant === "blue"
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "bg-primary/5 text-primary font-semibold"
                  : "text-slate-700"
              )}
            >
              <span className="truncate">{o.label}</span>
              {selected && (
                <span className={cn("font-semibold", variant === "blue" ? "text-blue-600" : "text-primary")}>✓</span>
              )}
            </button>
          );
        })}
        {filteredOptions.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">No results found</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-1 relative" ref={containerRef} id={id}>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          "w-full py-2 pl-3 pr-10 text-sm text-left border rounded-lg text-slate-900 focus:outline-none transition-colors flex items-center justify-between min-h-[38px] relative",
          disabled ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-border cursor-pointer",
          !disabled && (variant === "blue"
            ? "focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
            : "focus:ring-2 focus:ring-primary/25 focus:border-primary")
        )}
      >
        <span className="truncate">{displayValue()}</span>
        <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </button>

      {isOpen && typeof window !== "undefined" && createPortal(menuContent, document.body)}
    </div>
  );
}

