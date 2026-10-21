-- Refuse to run over manual edits: both columns must still be missing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'food_entries'
      AND column_name IN ('copied_from_date', 'is_undetailed')
  ) THEN
    RAISE EXCEPTION 'food_entries already has copied_from_date or is_undetailed — a manual change; reconcile it before applying this migration';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "food_entries" ADD COLUMN     "copied_from_date" DATE,
ADD COLUMN     "is_undetailed" BOOLEAN NOT NULL DEFAULT false;
