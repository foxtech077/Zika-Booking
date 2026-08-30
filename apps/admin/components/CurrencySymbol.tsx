import React from "react";

export interface CurrencySymbolProps extends React.HTMLAttributes<HTMLSpanElement> {
  currency: string;
}

const SYMBOL_MAP: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  MYR: "RM",
  SAR: "SAR",
  AED: "AED",
  XAF: "FCFA",
  XOF: "CFA",
  KES: "KSh",
  NGN: "₦",
  GHS: "GH₵",
  UGX: "USh",
  TZS: "TSh",
  RWF: "R₣",
  ZAR: "R",
  CDF: "FC",
  XPF: "₣",
};

export function CurrencySymbol({ currency, className, ...props }: CurrencySymbolProps) {
  const code = currency?.toUpperCase() || "";
  const symbol = SYMBOL_MAP[code] || code;

  return (
    <span className={className} {...props}>
      {symbol}
    </span>
  );
}
