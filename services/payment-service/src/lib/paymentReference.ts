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

export async function generateDisplayId(countryCode: string): Promise<string> {
  await ensurePaymentSequence();
  const result = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('payments.payment_seq') AS nextval`;
  const seq = Number(result[0]!.nextval);
  return `PAY${String(seq).padStart(5, "0")}-${countryCode.toUpperCase()}`;
}
