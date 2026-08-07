"use client";

/**
 * DiscountSection — shared discount toggle + fields for all listing form pricing steps.
 *
 * Rules:
 *  - Collapsed by default (toggle OFF).
 *  - When OFF  → renders only the header row; no data sent to the API.
 *  - When ON   → shows type selector, value input, optional date range, and live price preview.
 *  - Validation errors surface only when `tried === true` (matches existing form pattern).
 */

import { cn } from "@/lib/utils";
import { Input, Select } from "@/components/ui/Input";

// ── Types ────────────────────────────────────────────────────────────────────

export type DiscountType = "percentage" | "fixed";

export type DiscountField =
  | "discountEnabled"
  | "discountType"
  | "discountValue"
  | "discountStartDate"
  | "discountEndDate";

export interface DiscountState {
  discountEnabled: boolean;
  discountType: DiscountType;
  discountValue: string;
  discountStartDate: string;
  discountEndDate: string;
}

/** Returns the default discount state to merge into any form's initState. */
export function initDiscountState(src: any): DiscountState {
  const d = src?.discount;
  return {
    discountEnabled:   d?.enabled   ?? false,
    discountType:      d?.type      ?? "percentage",
    discountValue:     d?.value     != null ? String(d.value) : "",
    discountStartDate: d?.startDate ?? "",
    discountEndDate:   d?.endDate   ?? "",
  };
}

/**
 * Appends discount data to a payload object.
 * Only adds the `discount` key when the toggle is ON.
 * Call this at the end of every form's buildPayload().
 */
export function appendDiscountPayload(
  p: Record<string, unknown>,
  s: DiscountState,
): void {
  if (!s.discountEnabled) return; // intentionally omitted when off
  const val = Number(s.discountValue);
  p.discount = {
    enabled: true,
    type:    s.discountType,
    value:   val,
    ...(s.discountStartDate ? { startDate: s.discountStartDate } : {}),
    ...(s.discountEndDate   ? { endDate:   s.discountEndDate   } : {}),
  };
}

/**
 * Returns discount-related validation errors.
 * Designed to be spread into the existing validateStep array.
 *
 * @param s            Discount state slice
 * @param basePrice    The listing's base price string (pricePerNight or pricePerDay)
 * @param isCarListing When true, also ensures final price > 0 (discount < base price)
 */
export function validateDiscount(
  s: DiscountState,
  basePrice: string,
  isCarListing = false,
): Array<string | false> {
  if (!s.discountEnabled) return [];

  const val  = Number(s.discountValue);
  const base = Number(basePrice);

  // Compute final price for overflow guard
  const finalPrice =
    s.discountType === "percentage"
      ? base - (base * val) / 100
      : base - val;

  return [
    s.discountValue === ""
      && "Discount value is required when discount is enabled.",

    s.discountValue !== "" && val < 0
      && "Discount value cannot be negative.",

    s.discountType === "percentage" && s.discountValue !== "" && val > 100
      && "Percentage discount cannot exceed 100%.",

    // For car listings (and as a safety net for all): final price must be > 0
    isCarListing
      && s.discountValue !== ""
      && base > 0
      && finalPrice <= 0
      && "Discount cannot reduce the price to zero or below.",

    s.discountStartDate && s.discountEndDate && s.discountEndDate <= s.discountStartDate
      && "Discount end date must be after the start date.",
  ];
}

// ── UI helpers ───────────────────────────────────────────────────────────────

const DISCOUNT_TYPE_OPTIONS = [
  { value: "percentage", label: "Percentage (%)" },
  { value: "fixed",      label: "Fixed Amount"   },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", ZAR: "R",
};

function fmt(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface DiscountSectionProps extends DiscountState {
  /** Base price string (e.g. pricePerNight / pricePerDay) for live preview. */
  basePrice: string;
  currency: string;
  /** Short label shown in preview: "night" | "day" */
  priceLabel: string;
  /** Mirrors the parent form's `tried` flag — show errors only after attempted submit. */
  tried: boolean;
  onChange: (field: DiscountField, value: string | boolean) => void;
}

export function DiscountSection({
  discountEnabled,
  discountType,
  discountValue,
  discountStartDate,
  discountEndDate,
  basePrice,
  currency,
  priceLabel,
  tried,
  onChange,
}: DiscountSectionProps) {
  const base = Number(basePrice);
  const val  = Number(discountValue);

  const finalPrice =
    discountEnabled && base > 0 && discountValue !== ""
      ? discountType === "percentage"
        ? base - (base * val) / 100
        : base - val
      : null;

  const showPreview =
    discountEnabled &&
    base > 0 &&
    discountValue !== "" &&
    val > 0 &&
    finalPrice !== null &&
    finalPrice > 0;

  // Compute inline field errors (mirrors validateDiscount logic)
  const valueError =
    tried && discountEnabled
      ? discountValue === ""
        ? "Discount value is required."
        : val < 0
          ? "Cannot be negative."
          : discountType === "percentage" && val > 100
            ? "Percentage cannot exceed 100%."
            : finalPrice !== null && finalPrice <= 0
              ? "Discount exceeds base price — final price would be ≤ 0."
              : undefined
      : undefined;

  const dateError =
    tried &&
    discountEnabled &&
    discountStartDate &&
    discountEndDate &&
    discountEndDate <= discountStartDate
      ? "End date must be after start date."
      : undefined;

  return (
    <div className="border-t border-border pt-5 space-y-0">

      {/* ── Header row — always visible ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-lg shrink-0">
            🏷️
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Discount</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Optional promotional or seasonal pricing
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={discountEnabled}
          onClick={() => onChange("discountEnabled", !discountEnabled)}
          className={cn(
            "relative flex items-center w-11 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            discountEnabled ? "bg-primary" : "bg-slate-300",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
              discountEnabled ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      {/* ── Expanded content — animated in/out ── */}
      {discountEnabled && (
        <div className="mt-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-4 animate-fade-in">

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Discount Type"
              value={discountType}
              onChange={(e) => onChange("discountType", e.target.value)}
              options={DISCOUNT_TYPE_OPTIONS}
            />
            <Input
              label={discountType === "percentage" ? "Discount Value (%)" : "Discount Amount"}
              type="number"
              min="0"
              max={discountType === "percentage" ? "100" : undefined}
              step="0.01"
              value={discountValue}
              onChange={(e) => onChange("discountValue", e.target.value)}
              placeholder={discountType === "percentage" ? "E.g., 20" : "E.g., 50.00"}
              error={valueError}
              rightIcon={
                <span className="text-xs font-bold text-slate-400 select-none">
                  {discountType === "percentage" ? "%" : (CURRENCY_SYMBOLS[currency] ?? "")}
                </span>
              }
            />
          </div>

          {/* Optional date range */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Applicable Period{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={discountStartDate}
                onChange={(e) => onChange("discountStartDate", e.target.value)}
              />
              <Input
                label="End Date"
                type="date"
                value={discountEndDate}
                onChange={(e) => onChange("discountEndDate", e.target.value)}
                error={dateError}
              />
            </div>
          </div>

          {/* Live price preview */}
          {showPreview && (
            <div className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-4 py-3 animate-fade-in">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  💰 Price Preview
                </p>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-sm text-slate-400 line-through">
                    {fmt(base, currency)}
                    <span className="text-xs">/{priceLabel}</span>
                  </span>
                  <span className="text-lg font-black text-emerald-600">
                    {fmt(finalPrice!, currency)}
                    <span className="text-xs font-semibold">/{priceLabel}</span>
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold text-white bg-emerald-500 px-3 py-1.5 rounded-full">
                {discountType === "percentage"
                  ? `${val}% OFF`
                  : `${CURRENCY_SYMBOLS[currency] ?? ""}${val} OFF`}
              </span>
            </div>
          )}

          {/* Guard: warn when discount leaves price at 0 or below */}
          {discountEnabled && discountValue !== "" && finalPrice !== null && finalPrice <= 0 && (
            <p className="text-xs text-danger font-semibold">
              ⚠️ The discount exceeds the base price. Please reduce the discount value.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
