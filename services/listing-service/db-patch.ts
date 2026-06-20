import { prisma } from "./src/lib/prisma.js";

async function main() {
  console.log("=== Running listing-service DB patch ===\n");

  // ── listing.vouchers ──────────────────────────────────────────────────────
  console.log("[1/6] Patching listing.vouchers...");
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS title                VARCHAR(100) NOT NULL DEFAULT '';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS activity_scope       VARCHAR(30)  NOT NULL DEFAULT 'universal';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS status               VARCHAR(20)  NOT NULL DEFAULT 'active';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS usage_limit_per_guest INTEGER     NOT NULL DEFAULT 1;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS applicable_tiers     TEXT[]       NOT NULL DEFAULT '{}';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS country_scope        CHAR(2);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS auto_assign          BOOLEAN      NOT NULL DEFAULT false;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.vouchers ADD COLUMN IF NOT EXISTS min_points_redemption INTEGER;`);
  console.log("   ✓ listing.vouchers patched\n");

  // ── listing.bookings ──────────────────────────────────────────────────────
  console.log("[2/6] Patching listing.bookings...");
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS earned_points   INTEGER        NOT NULL DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS redeem_points   INTEGER        NOT NULL DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  console.log("   ✓ listing.bookings patched\n");

  // ── listing.platform_settings ─────────────────────────────────────────────
  console.log("[3/6] Patching listing.platform_settings...");
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.platform_settings ADD COLUMN IF NOT EXISTS pending_global_rate             DECIMAL(6,4);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.platform_settings ADD COLUMN IF NOT EXISTS pending_global_effective_from   TIMESTAMP;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.platform_settings ADD COLUMN IF NOT EXISTS pending_global_reason           VARCHAR(500);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.platform_settings ADD COLUMN IF NOT EXISTS updated_by                     VARCHAR(100);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.platform_settings ADD COLUMN IF NOT EXISTS points_to_currency_ratio        INTEGER NOT NULL DEFAULT 100;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.platform_settings ADD COLUMN IF NOT EXISTS min_points_redemption           INTEGER NOT NULL DEFAULT 500;`);
  console.log("   ✓ listing.platform_settings patched\n");

  // ── listing.commission_rates ──────────────────────────────────────────────
  console.log("[4/6] Patching listing.commission_rates...");
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.commission_rates ADD COLUMN IF NOT EXISTS pending_rate              DECIMAL(6,4);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.commission_rates ADD COLUMN IF NOT EXISTS pending_effective_from    TIMESTAMP;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE listing.commission_rates ADD COLUMN IF NOT EXISTS pending_reason            VARCHAR(500);`);
  console.log("   ✓ listing.commission_rates patched\n");

  // ── listing.commission_history (new table) ────────────────────────────────
  console.log("[5/6] Creating listing.commission_history if not exists...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS listing.commission_history (
      id                 VARCHAR(36)    NOT NULL DEFAULT gen_random_uuid()::text,
      scope              VARCHAR(10)    NOT NULL,
      country_code       CHAR(2),
      old_rate           DECIMAL(6,4)   NOT NULL,
      new_rate           DECIMAL(6,4)   NOT NULL,
      effective_from     TIMESTAMP      NOT NULL,
      changed_by         VARCHAR(100)   NOT NULL,
      changed_by_role    VARCHAR(50)    NOT NULL,
      reason             VARCHAR(500)   NOT NULL,
      apply_to_all       BOOLEAN        NOT NULL DEFAULT false,
      providers_notified BOOLEAN        NOT NULL DEFAULT false,
      created_at         TIMESTAMP      NOT NULL DEFAULT NOW(),
      CONSTRAINT commission_history_pkey PRIMARY KEY (id)
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS commission_history_scope_idx    ON listing.commission_history(scope);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS commission_history_country_idx  ON listing.commission_history(country_code);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS commission_history_created_idx  ON listing.commission_history(created_at DESC);`);
  console.log("   ✓ listing.commission_history ready\n");

  // ── auth.loyalty_transactions (new table) ─────────────────────────────────
  console.log("[6/6] Creating auth.loyalty_transactions if not exists...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS auth.loyalty_transactions (
      id           VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::text,
      user_id      VARCHAR(255) NOT NULL,
      type         VARCHAR(30)  NOT NULL,
      points       INTEGER      NOT NULL,
      balance_after INTEGER     NOT NULL,
      booking_id   VARCHAR(255),
      description  VARCHAR(255),
      created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
      CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id),
      CONSTRAINT loyalty_transactions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth."User"(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS loyalty_transactions_user_id_idx    ON auth.loyalty_transactions(user_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS loyalty_transactions_booking_id_idx ON auth.loyalty_transactions(booking_id);`);
  console.log("   ✓ auth.loyalty_transactions ready\n");

  console.log("=== DB patch complete ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
