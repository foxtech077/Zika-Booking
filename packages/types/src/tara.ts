/**
 * Tara Mobile Money — supported countries and shared payment rules.
 *
 * Single source of truth shared by the web app, mobile app and payment
 * service so that eligibility, phone-number validation and currency handling
 * behave identically on every layer:
 *
 *   - The Mobile Money option is shown iff the listing's country is one of
 *     TARA_COUNTRIES (currency is irrelevant for visibility).
 *   - The guest may actually pay iff the parsed phone number's country is one
 *     of TARA_COUNTRIES.
 *   - Payment is always processed in XAF: directly when the listing currency
 *     is XAF, otherwise the listing total is converted to XAF first.
 */

export interface TaraCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  currency: string;
}

export const TARA_COUNTRIES_LIST: TaraCountry[] = [
  { code: "BJ", name: "Benin", dialCode: "+229", flag: "🇧🇯", currency: "XOF" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫", currency: "XOF" },
  { code: "CM", name: "Cameroon", dialCode: "+237", flag: "🇨🇲", currency: "XAF" },
  { code: "CG", name: "Congo (Brazzaville)", dialCode: "+242", flag: "🇨🇬", currency: "XAF" },
  { code: "CD", name: "DR Congo", dialCode: "+243", flag: "🇨🇩", currency: "CDF" },
  { code: "CI", name: "Côte d'Ivoire", dialCode: "+225", flag: "🇨🇮", currency: "XOF" },
  { code: "GA", name: "Gabon", dialCode: "+241", flag: "🇬🇦", currency: "XAF" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪", currency: "KES" },
  { code: "RW", name: "Rwanda", dialCode: "+250", flag: "🇷🇼", currency: "RWF" },
  { code: "SN", name: "Senegal", dialCode: "+221", flag: "🇸🇳", currency: "XOF" },
  { code: "SL", name: "Sierra Leone", dialCode: "+232", flag: "🇸🇱", currency: "SLL" },
  { code: "UG", name: "Uganda", dialCode: "+256", flag: "🇺🇬", currency: "UGX" },
  { code: "TZ", name: "Tanzania", dialCode: "+255", flag: "🇹🇿", currency: "TZS" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭", currency: "GHS" },
  { code: "ZM", name: "Zambia", dialCode: "+260", flag: "🇿🇲", currency: "ZMW" },
];

export const TARA_COUNTRIES: ReadonlySet<string> = new Set(
  TARA_COUNTRIES_LIST.map((c) => c.code),
);

export const TARA_PHONE_PREFIXES: ReadonlySet<string> = new Set(
  TARA_COUNTRIES_LIST.map((c) => c.dialCode),
);

/** True when the ISO-3166-1 alpha-2 country code is a Tara-supported country. */
export function isTaraCountry(countryCode: string | null | undefined): boolean {
  return typeof countryCode === "string" && TARA_COUNTRIES.has(countryCode.toUpperCase().trim());
}
