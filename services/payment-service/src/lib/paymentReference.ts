import { prisma } from "./prisma.js";

let sequenceInitialized = false;

export async function ensurePaymentSequence(): Promise<void> {
  if (sequenceInitialized) return;
  await prisma.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS payments.payment_seq START WITH 1 INCREMENT BY 1`,
  );
  sequenceInitialized = true;
}

export function extractCountryCode(reference: string): string {
  const parts = reference.split("-");
  return parts.length >= 3 ? parts[parts.length - 1]! : "XX";
}

/**
 * Resolve the ISO-3166-1 alpha-2 country for a payment from the booking's
 * listing country when available, falling back to the reference suffix
 * (KAIN-XXXXXX-CC). Used for the immutable country-code snapshot.
 */
export function resolvePaymentCountry(
  booking: { listing?: { country?: string | null } | null; reference?: string | null } | null | undefined,
): string | null {
  const listingCountry = booking?.listing?.country;
  if (listingCountry && listingCountry.length === 2) return listingCountry.toUpperCase();
  const reference = booking?.reference;
  if (reference) {
    const cc = extractCountryCode(reference);
    if (cc && cc.length === 2) return cc.toUpperCase();
  }
  return null;
}

export async function generateDisplayId(countryCode: string): Promise<string> {
  await ensurePaymentSequence();
  const result = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('payments.payment_seq') AS nextval`;
  const seq = Number(result[0]!.nextval);
  return `PAY${String(seq).padStart(5, "0")}-${countryCode.toUpperCase()}`;
}
