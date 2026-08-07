export interface Country {
  name: string;
  code: string;
  dialCode: string;
}

export const COUNTRIES: Country[] = [
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966" },
  { name: "Qatar", code: "QA", dialCode: "+974" },
  { name: "Kenya", code: "KE", dialCode: "+254" },
  { name: "Tanzania", code: "TZ", dialCode: "+255" },
  { name: "Uganda", code: "UG", dialCode: "+256" },
  { name: "United States", code: "US", dialCode: "+1" },
  { name: "United Kingdom", code: "GB", dialCode: "+44" },
  { name: "Germany", code: "DE", dialCode: "+49" },
  { name: "France", code: "FR", dialCode: "+33" },
  { name: "Spain", code: "ES", dialCode: "+34" },
  { name: "Italy", code: "IT", dialCode: "+39" },
  { name: "Canada", code: "CA", dialCode: "+1" },
  { name: "Australia", code: "AU", dialCode: "+61" },
  { name: "Japan", code: "JP", dialCode: "+81" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
  { name: "Netherlands", code: "NL", dialCode: "+31" },
  { name: "Belgium", code: "BE", dialCode: "+32" },
  { name: "Sweden", code: "SE", dialCode: "+46" },
  { name: "Malta", code: "MT", dialCode: "+356" },
  { name: "Nigeria", code: "NG", dialCode: "+234" },
  { name: "South Africa", code: "ZA", dialCode: "+27" },
  { name: "Ghana", code: "GH", dialCode: "+233" },
  { name: "Bahrain", code: "BH", dialCode: "+973" },
  { name: "Kuwait", code: "KW", dialCode: "+965" },
  { name: "Oman", code: "OM", dialCode: "+968" },
  { name: "Egypt", code: "EG", dialCode: "+20" },
  { name: "Jordan", code: "JO", dialCode: "+962" },
  { name: "Lebanon", code: "LB", dialCode: "+961" },
  { name: "Malaysia", code: "MY", dialCode: "+60" },
  { name: "Thailand", code: "TH", dialCode: "+66" },
  { name: "Philippines", code: "PH", dialCode: "+63" },
  { name: "Indonesia", code: "ID", dialCode: "+62" },
  { name: "Vietnam", code: "VN", dialCode: "+84" },
  { name: "Turkey", code: "TR", dialCode: "+90" },
  { name: "Brazil", code: "BR", dialCode: "+55" },
  { name: "Mexico", code: "MX", dialCode: "+52" },
  { name: "Argentina", code: "AR", dialCode: "+54" },
  { name: "New Zealand", code: "NZ", dialCode: "+64" },
  { name: "Ireland", code: "IE", dialCode: "+353" },
  { name: "Switzerland", code: "CH", dialCode: "+41" },
  { name: "Austria", code: "AT", dialCode: "+43" },
  { name: "Norway", code: "NO", dialCode: "+47" },
  { name: "Denmark", code: "DK", dialCode: "+45" },
  { name: "Finland", code: "FI", dialCode: "+358" },
  { name: "Poland", code: "PL", dialCode: "+48" },
  { name: "Greece", code: "GR", dialCode: "+30" },
  { name: "Portugal", code: "PT", dialCode: "+351" },
  { name: "Israel", code: "IL", dialCode: "+972" },
];

export function getCountryFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

export interface BookingCountry {
  name: string;
  code: string;
  flag: string;
}

export const SYSTEM_COUNTRIES: BookingCountry[] = COUNTRIES.map(c => ({
  name: c.name,
  code: c.code,
  flag: getCountryFlag(c.code)
})).sort((a, b) => a.name.localeCompare(b.name));

export const BOOKING_COUNTRIES = SYSTEM_COUNTRIES;
