-- ============================================================
-- Production catch-up migration
-- Applies all missing listing-service schema changes that were
-- created locally but never applied to production.
--
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- so this script is fully idempotent and safe to re-run.
-- ============================================================

-- ── 1. Add extended columns to vouchers table ─────────────────────────────────
-- (from migration 20260613000000_add_voucher_columns)

ALTER TABLE listing.vouchers
  ADD COLUMN IF NOT EXISTS "title"                 VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "description"           VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "activity_scope"        VARCHAR(30)  NOT NULL DEFAULT 'universal',
  ADD COLUMN IF NOT EXISTS "usage_limit_per_guest" INTEGER      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "status"                VARCHAR(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "applicable_tiers"      TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "country_scope"         CHAR(2),
  ADD COLUMN IF NOT EXISTS "auto_assign"           BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "min_points_redemption" INTEGER;

-- Sync status with isActive for any pre-existing vouchers
UPDATE listing.vouchers
  SET "status" = 'paused'
  WHERE "is_active" = false AND "status" = 'active';

-- ── 2. Add platform_settings table ───────────────────────────────────────────
-- (from migration 20260617000000_add_platform_settings)

CREATE TABLE IF NOT EXISTS listing.platform_settings (
  id                              TEXT         NOT NULL DEFAULT 'global',
  global_commission_rate          DECIMAL(6,4) NOT NULL DEFAULT 0.0500,
  pending_global_rate             DECIMAL(6,4),
  pending_global_effective_from   TIMESTAMP(3),
  pending_global_reason           VARCHAR(500),
  points_to_currency_ratio        INTEGER      NOT NULL DEFAULT 100,
  min_points_redemption           INTEGER      NOT NULL DEFAULT 500,
  updated_at                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by                      VARCHAR(100),
  CONSTRAINT platform_settings_pkey PRIMARY KEY (id)
);

-- Seed the single global settings row if not present
INSERT INTO listing.platform_settings (id)
  VALUES ('global')
  ON CONFLICT DO NOTHING;

-- ── 3. Add loyalty / points columns to bookings table ─────────────────────────
-- (from migration 20260618000000_add_loyalty_settings and related)

ALTER TABLE listing.bookings
  ADD COLUMN IF NOT EXISTS "service_fee"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_amount"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "redeem_points"   INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "points_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "earned_points"   INTEGER       NOT NULL DEFAULT 0;

-- ── 4. Add reports table ──────────────────────────────────────────────────────
-- (from migration 20260620090000_add_reports_table)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ReportStatus' AND n.nspname = 'listing'
  ) THEN
    CREATE TYPE listing."ReportStatus" AS ENUM (
      'pending', 'investigating', 'resolved', 'dismissed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS listing.reports (
  id           TEXT                     NOT NULL,
  reporter_id  TEXT                     NOT NULL,
  target_type  VARCHAR(50)              NOT NULL,
  target_id    TEXT                     NOT NULL,
  reason       VARCHAR(100)             NOT NULL,
  description  TEXT,
  status       listing."ReportStatus"   NOT NULL DEFAULT 'pending',
  admin_note   TEXT,
  resolved_at  TIMESTAMP(3),
  resolved_by  TEXT,
  created_at   TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reports_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS reports_status_idx
  ON listing.reports (status);
CREATE INDEX IF NOT EXISTS reports_target_idx
  ON listing.reports (target_type, target_id);

-- ── 5. Add activity_promotions table ─────────────────────────────────────────
-- (from migration 20260620110000_add_activity_promotions)

CREATE TABLE IF NOT EXISTS listing.activity_promotions (
  id               TEXT          NOT NULL,
  activity         VARCHAR(20)   NOT NULL,
  label_text       VARCHAR(6)    NOT NULL,
  label_colour     VARCHAR(10)   NOT NULL DEFAULT '#C84B2F',
  discount_type    VARCHAR(20)   NOT NULL DEFAULT 'label_only',
  discount_value   DECIMAL(10,2),
  valid_from       TIMESTAMP(3)  NOT NULL,
  valid_until      TIMESTAMP(3)  NOT NULL,
  apply_to_booking BOOLEAN       NOT NULL DEFAULT false,
  banner_title     VARCHAR(100)  NOT NULL,
  banner_subtitle  VARCHAR(200),
  status           VARCHAR(20)   NOT NULL DEFAULT 'scheduled',
  country_scope    CHAR(2),
  created_at       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_promotions_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS activity_promotions_activity_status_idx
  ON listing.activity_promotions (activity, status);
CREATE INDEX IF NOT EXISTS activity_promotions_status_valid_idx
  ON listing.activity_promotions (status, valid_from, valid_until);

