-- Facts get the groups of «Пам'ять · Про тебе» (FOOD / SCHEDULE / TRAINING / OTHER) and a normalized
-- text for «one active fact per text». Nothing in the app writes facts before 0.9.0, so only seed rows
-- can exist: every old food category becomes FOOD, OTHER stays OTHER.

-- Refuse to run over manual edits or over data the backfill cannot make unique.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'user_facts' AND column_name = 'text_normalized'
  ) THEN
    RAISE EXCEPTION 'user_facts.text_normalized already exists — a manual change; reconcile it before applying this migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM user_facts
    WHERE deleted_at IS NULL AND status <> 'REJECTED'
    GROUP BY user_id, lower(btrim(regexp_replace(text, '\s+', ' ', 'g')))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'user_facts has active duplicates by normalized text — resolve them by hand before applying this migration';
  END IF;
END $$;

-- AlterEnum: a new type, existing rows mapped explicitly
ALTER TYPE "fact_category" RENAME TO "fact_category_old";
CREATE TYPE "fact_category" AS ENUM ('FOOD', 'SCHEDULE', 'TRAINING', 'OTHER');
ALTER TABLE "user_facts" ALTER COLUMN "category" TYPE "fact_category" USING (
  CASE "category"::text
    WHEN 'OTHER' THEN 'OTHER'
    ELSE 'FOOD'
  END
)::"fact_category";
DROP TYPE "fact_category_old";

-- AlterTable: same normalization as normalizeName (lowercase, trimmed, single spaces)
ALTER TABLE "user_facts" ADD COLUMN "text_normalized" TEXT;
UPDATE "user_facts" SET "text_normalized" = lower(btrim(regexp_replace("text", '\s+', ' ', 'g')));
ALTER TABLE "user_facts" ALTER COLUMN "text_normalized" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_facts_user_id_text_normalized_key" ON "user_facts"("user_id", "text_normalized") WHERE deleted_at IS NULL AND status <> 'REJECTED';
