// Countries where Tara (mobile money) is recommended first.
// Covers all operators from the product spec:
// M-Pesa: KE TZ CD MZ  |  MTN MoMo: UG GH RW CM CI
// Orange: SN ML BF MG  |  Airtel: ZM MW NE  |  Wave: SN CI  |  MoMo SA: ZA
export const paymentRoutingConfig = {
  taraCountries: new Set([
    "KE", "TZ", "CD", "MZ",           // M-Pesa
    "UG", "GH", "RW", "CM", "CI",     // MTN MoMo
    "SN", "ML", "BF", "MG",           // Orange Money
    "ZM", "MW", "NE",                  // Airtel Money
    "ZA",                              // MoMo SA
    "NG",                              // also strong mobile money market
  ]),
};