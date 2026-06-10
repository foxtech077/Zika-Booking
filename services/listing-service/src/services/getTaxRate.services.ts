export function getTaxRate(country?: string | null): number {
    if (!country) return 0;
  
    const c = country.toUpperCase();
  
    if (["KE", "NG", "GH"].includes(c)) return 0.16;
    if (["FR", "UK"].includes(c)) return 0.20;
    if (["UAE"].includes(c)) return 0.05;
    if (["ZA"].includes(c)) return 0.10;
  
    return 0;
  }