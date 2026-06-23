-- ============================================================
-- Migration: add_commission_history_table
-- Creates the commission_history table that was defined in
-- schema.prisma but was never included in any previous migration.
-- This is required for POST /admin/commission-rates to work.
--
-- Safe to re-run: uses IF NOT EXISTS throughout.
-- ============================================================

CREATE TABLE IF NOT EXISTS listing.commission_history (
  id                  TEXT          NOT NULL,
  scope               VARCHAR(10)   NOT NULL,
  country_code        CHAR(2),
  old_rate            DECIMAL(6,4)  NOT NULL,
  new_rate            DECIMAL(6,4)  NOT NULL,
  effective_from      TIMESTAMP(3)  NOT NULL,
  changed_by          VARCHAR(100)  NOT NULL,
  changed_by_role     VARCHAR(50)   NOT NULL,
  reason              VARCHAR(500)  NOT NULL,
  apply_to_all        BOOLEAN       NOT NULL DEFAULT false,
  providers_notified  BOOLEAN       NOT NULL DEFAULT false,
  created_at          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT commission_history_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS commission_history_scope_idx
  ON listing.commission_history (scope);

CREATE INDEX IF NOT EXISTS commission_history_country_idx
  ON listing.commission_history (country_code);

CREATE INDEX IF NOT EXISTS commission_history_created_idx
  ON listing.commission_history (created_at DESC);
