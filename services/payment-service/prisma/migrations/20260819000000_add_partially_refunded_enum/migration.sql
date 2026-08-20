-- Add missing PaymentStatus enum value `partially_refunded`.

-- The initial migration created PaymentStatus without this value, but the Prisma
-- schema has included it since the refund feature shipped. The refund webhook and
-- admin refund approval set this status via the Prisma client, and dashboard
-- aggregation queries filter on it — both fail with "invalid input value for
-- enum payments.PaymentStatus" on any database that applied the migrations.
-- Added at the end of the enum to stay compatible with PostgreSQL < 12 where
-- ALTER TYPE ADD VALUE cannot specify a position inside a transaction.
ALTER TYPE "payments"."PaymentStatus" ADD VALUE IF NOT EXISTS 'partially_refunded';