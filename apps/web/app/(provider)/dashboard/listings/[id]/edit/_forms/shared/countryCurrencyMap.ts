/**
 * countryCurrencyMap.ts
 *
 * Maps ISO 3166-1 alpha-2 country codes (uppercase, 2-letter)
 * to their primary ISO 4217 currency codes.
 *
 * Used by listing forms to auto-populate the Currency field
 * whenever the user selects or changes the Country field.
 */

export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  AE: "AED", // United Arab Emirates
  AF: "AFN", // Afghanistan
  AL: "ALL", // Albania
  AM: "AMD", // Armenia
  AO: "AOA", // Angola
  AR: "ARS", // Argentina
  AU: "AUD", // Australia
  AW: "AWG", // Aruba
  AZ: "AZN", // Azerbaijan
  BA: "BAM", // Bosnia and Herzegovina
  BB: "BBD", // Barbados
  BD: "BDT", // Bangladesh
  BG: "BGN", // Bulgaria
  BH: "BHD", // Bahrain
  BI: "BIF", // Burundi
  BM: "BMD", // Bermuda
  BN: "BND", // Brunei
  BO: "BOB", // Bolivia
  BR: "BRL", // Brazil
  BS: "BSD", // Bahamas
  BT: "BTN", // Bhutan
  BW: "BWP", // Botswana
  BY: "BYN", // Belarus
  BZ: "BZD", // Belize
  CA: "CAD", // Canada
  CD: "CDF", // Democratic Republic of the Congo
  CH: "CHF", // Switzerland
  CL: "CLP", // Chile
  CN: "CNY", // China
  CO: "COP", // Colombia
  CR: "CRC", // Costa Rica
  CU: "CUP", // Cuba
  CV: "CVE", // Cape Verde
  CZ: "CZK", // Czech Republic
  DJ: "DJF", // Djibouti
  DK: "DKK", // Denmark
  DO: "DOP", // Dominican Republic
  DZ: "DZD", // Algeria
  EG: "EGP", // Egypt
  ER: "ERN", // Eritrea
  ET: "ETB", // Ethiopia
  EU: "EUR", // European Union (placeholder)
  FI: "EUR", // Finland
  FJ: "FJD", // Fiji
  FK: "FKP", // Falkland Islands
  FR: "EUR", // France
  DE: "EUR", // Germany
  GB: "GBP", // United Kingdom
  GE: "GEL", // Georgia
  GH: "GHS", // Ghana
  GI: "GIP", // Gibraltar
  GM: "GMD", // Gambia
  GN: "GNF", // Guinea
  GR: "EUR", // Greece
  GT: "GTQ", // Guatemala
  GY: "GYD", // Guyana
  HK: "HKD", // Hong Kong
  HN: "HNL", // Honduras
  HR: "EUR", // Croatia (adopted EUR in 2023)
  HT: "HTG", // Haiti
  HU: "HUF", // Hungary
  ID: "IDR", // Indonesia
  IE: "EUR", // Ireland
  IL: "ILS", // Israel
  IN: "INR", // India
  IQ: "IQD", // Iraq
  IR: "IRR", // Iran
  IS: "ISK", // Iceland
  IT: "EUR", // Italy
  JM: "JMD", // Jamaica
  JO: "JOD", // Jordan
  JP: "JPY", // Japan
  KE: "KES", // Kenya
  KG: "KGS", // Kyrgyzstan
  KH: "KHR", // Cambodia
  KM: "KMF", // Comoros
  KP: "KPW", // North Korea
  KR: "KRW", // South Korea
  KW: "KWD", // Kuwait
  KY: "KYD", // Cayman Islands
  KZ: "KZT", // Kazakhstan
  LA: "LAK", // Laos
  LB: "LBP", // Lebanon
  LK: "LKR", // Sri Lanka
  LR: "LRD", // Liberia
  LS: "LSL", // Lesotho
  LY: "LYD", // Libya
  MA: "MAD", // Morocco
  MD: "MDL", // Moldova
  MG: "MGA", // Madagascar
  MK: "MKD", // North Macedonia
  MM: "MMK", // Myanmar
  MN: "MNT", // Mongolia
  MO: "MOP", // Macau
  MR: "MRU", // Mauritania
  MU: "MUR", // Mauritius
  MV: "MVR", // Maldives
  MW: "MWK", // Malawi
  MX: "MXN", // Mexico
  MY: "MYR", // Malaysia
  MZ: "MZN", // Mozambique
  NA: "NAD", // Namibia
  NG: "NGN", // Nigeria
  NI: "NIO", // Nicaragua
  NL: "EUR", // Netherlands
  NO: "NOK", // Norway
  NP: "NPR", // Nepal
  NZ: "NZD", // New Zealand
  OM: "OMR", // Oman
  PA: "PAB", // Panama
  PE: "PEN", // Peru
  PG: "PGK", // Papua New Guinea
  PH: "PHP", // Philippines
  PK: "PKR", // Pakistan
  PL: "PLN", // Poland
  PT: "EUR", // Portugal
  PY: "PYG", // Paraguay
  QA: "QAR", // Qatar
  RO: "RON", // Romania
  RS: "RSD", // Serbia
  RU: "RUB", // Russia
  RW: "RWF", // Rwanda
  SA: "SAR", // Saudi Arabia
  SB: "SBD", // Solomon Islands
  SC: "SCR", // Seychelles
  SD: "SDG", // Sudan
  SE: "SEK", // Sweden
  SG: "SGD", // Singapore
  SH: "SHP", // Saint Helena
  SL: "SLL", // Sierra Leone
  SO: "SOS", // Somalia
  SR: "SRD", // Suriname
  SS: "SSP", // South Sudan
  ST: "STN", // São Tomé and Príncipe
  SY: "SYP", // Syria
  SZ: "SZL", // Eswatini
  TH: "THB", // Thailand
  TJ: "TJS", // Tajikistan
  TM: "TMT", // Turkmenistan
  TN: "TND", // Tunisia
  TO: "TOP", // Tonga
  TR: "TRY", // Turkey
  TT: "TTD", // Trinidad and Tobago
  TW: "TWD", // Taiwan
  TZ: "TZS", // Tanzania
  UA: "UAH", // Ukraine
  UG: "UGX", // Uganda
  US: "USD", // United States
  UY: "UYU", // Uruguay
  UZ: "UZS", // Uzbekistan
  VE: "VES", // Venezuela
  VN: "VND", // Vietnam
  VU: "VUV", // Vanuatu
  WS: "WST", // Samoa
  YE: "YER", // Yemen
  ZA: "ZAR", // South Africa
  ZM: "ZMW", // Zambia
  ZW: "ZWL", // Zimbabwe
};

/**
 * Returns the ISO 4217 currency code for the given 2-letter country code.
 * Returns `null` if no mapping is found, so the caller can decide whether
 * to keep the existing value or leave the field empty.
 */
export function getCurrencyForCountry(countryCode: string): string | null {
  if (!countryCode) return null;
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase().trim()] ?? null;
}
