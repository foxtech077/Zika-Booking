-- Accent-insensitive, scalable destination search.
-- unaccent strips diacritics (Makepe ⇄ Maképé); pg_trgm provides the
-- trigram GIN operator class that makes `LIKE '%term%'` partial matches
-- fast instead of a full table scan as the listings table grows.
-- Both are installed into public (where postgis lives) because the search
-- service references them as public.f_unaccent / public.gin_trgm_ops.
--
-- NOTE: unaccent(text) is not IMMUTABLE on every server, but index
-- expressions must be immutable, so a stable wrapper is used.

CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS 'SELECT public.unaccent($1)';

CREATE INDEX IF NOT EXISTS "listings_search_name_gin_idx"
  ON listing.listings
  USING gin (public.f_unaccent(lower(name)) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "listings_search_town_gin_idx"
  ON listing.listings
  USING gin (public.f_unaccent(lower(town)) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "listings_search_neighborhood_gin_idx"
  ON listing.listings
  USING gin (public.f_unaccent(lower(neighborhood)) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "listings_search_address_gin_idx"
  ON listing.listings
  USING gin (public.f_unaccent(lower(address)) public.gin_trgm_ops);
