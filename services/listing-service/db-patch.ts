import { prisma } from "./src/lib/prisma.js";

async function main() {
  console.log("=== Running listing-service DB patch ===\n");

  // ── listing.vouchers ──────────────────────────────────────────────────────
  console.log("[1/3] Patching listing.vouchers...");
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS title               VARCHAR(100) NOT NULL DEFAULT '';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS activity_scope      VARCHAR(30)  NOT NULL DEFAULT 'universal';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS status              VARCHAR(20)  NOT NULL DEFAULT 'active';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS usage_limit_per_guest INTEGER NOT NULL DEFAULT 1;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS applicable_tiers    TEXT[]       NOT NULL DEFAULT '{}';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS country_scope       CHAR(2);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS auto_assign         BOOLEAN      NOT NULL DEFAULT false;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS min_points_redemption INTEGER;`);
  console.log("   ✓ listing.vouchers patched\n");

  // ── listing.bookings ──────────────────────────────────────────────────────
  console.log("[2/3] Patching listing.bookings...");
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS earned_points   INTEGER        NOT NULL DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS redeem_points   INTEGER        NOT NULL DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  console.log("   ✓ listing.bookings patched\n");

  // ── listing.platform_settings ─────────────────────────────────────────────
  console.log("[3/3] Patching listing.platform_settings...");
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.platform_settings ADD COLUMN IF NOT EXISTS points_to_currency_ratio INTEGER NOT NULL DEFAULT 100;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.platform_settings ADD COLUMN IF NOT EXISTS min_points_redemption    INTEGER NOT NULL DEFAULT 500;`);
  console.log("   ✓ listing.platform_settings patched\n");

  console.log("=== DB patch complete ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
