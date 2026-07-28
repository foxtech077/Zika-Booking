DO $$ BEGIN
  ALTER TYPE "payments"."PayoutStatus" ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
