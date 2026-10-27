-- Refuse to run over manual edits: neither the type nor the column may exist yet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'address_form') THEN
    RAISE EXCEPTION 'type address_form already exists — a manual change; reconcile it before applying this migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'address_form'
  ) THEN
    RAISE EXCEPTION 'users.address_form already exists — a manual change; reconcile it before applying this migration';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "address_form" AS ENUM ('MASCULINE', 'FEMININE', 'NEUTRAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address_form" "address_form" NOT NULL DEFAULT 'NEUTRAL';
