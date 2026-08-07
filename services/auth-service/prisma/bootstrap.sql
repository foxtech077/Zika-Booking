-- ============================================================================
-- Cross-service migration-history bootstrap (idempotent)
--
-- All three backend services share the same physical database (zika_booking)
-- but each keeps its own Prisma migration history. Prisma stores that history
-- in a _prisma_migrations table that lives in EACH service's own search-path
-- schema (listing / payments). Because every service's datasource also lists
-- the shared `auth` schema, `prisma migrate deploy` will see auth's
-- _prisma_migrations table during its initialization check and assume its own
-- history exists — then fail with "Invariant violation: migration persistence
-- is not initialized" because its own table is missing.
--
-- This script pre-creates the empty migration-history tables for the sibling
-- services so their `migrate deploy` runs cleanly on a fresh database.
-- Every statement is guarded with IF NOT EXISTS / ON CONFLICT, so it is safe
-- to re-run on every deploy / boot.
--
-- Run BEFORE deploying the listing- and payment-services. Must run after the
-- auth-service migrations (it depends on nothing in auth, but the auth schema
-- must exist first if auth migrations create it).
-- ============================================================================

-- PostGIS must live in the public schema (the listing-service references it as
-- public.geography / public.ST_MakePoint). If it is not installed before the
-- listing-service's `enable_postgis` migration runs, a fresh CREATE EXTENSION
-- can trip Prisma's migration bookkeeping (P1014) and, if the search_path does
-- not point at public, install the extension into the wrong schema. Installing
-- it here first makes the listing migration's CREATE EXTENSION IF NOT EXISTS a
-- no-op.
--
-- NOTE: postgis_topology is intentionally NOT installed here — it is not used
-- by any service and requires superuser privileges (unlike the trusted
-- postgis extension), so the app DB user would be unable to create it.
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- Schemas must exist before the tables below can be created.
CREATE SCHEMA IF NOT EXISTS listing;
CREATE SCHEMA IF NOT EXISTS payments;

-- Listing-service migration history (mirrors Prisma's postgres structure).
CREATE TABLE IF NOT EXISTS listing._prisma_migrations (
  id                  VARCHAR(36) PRIMARY KEY NOT NULL,
  checksum            VARCHAR(64) NOT NULL,
  finished_at         TIMESTAMPTZ,
  migration_name      VARCHAR(255) NOT NULL,
  logs                TEXT,
  rolled_back_at      TIMESTAMPTZ,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count INTEGER NOT NULL DEFAULT 0
);

-- Payment-service migration history (mirrors Prisma's postgres structure).
CREATE TABLE IF NOT EXISTS payments._prisma_migrations (
  id                  VARCHAR(36) PRIMARY KEY NOT NULL,
  checksum            VARCHAR(64) NOT NULL,
  finished_at         TIMESTAMPTZ,
  migration_name      VARCHAR(255) NOT NULL,
  logs                TEXT,
  rolled_back_at      TIMESTAMPTZ,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count INTEGER NOT NULL DEFAULT 0
);
