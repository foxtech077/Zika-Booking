-- Install PostGIS into the public schema explicitly. Without the SCHEMA clause
-- the extension lands in the connection's search_path (the "listing" schema),
-- but later migrations reference it as public.geography / public.ST_MakePoint.
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
