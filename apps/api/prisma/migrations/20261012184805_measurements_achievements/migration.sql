-- CreateEnum
CREATE TYPE "measurement_kind" AS ENUM ('WEIGHT', 'WAIST');

-- CreateEnum
CREATE TYPE "measurement_source" AS ENUM ('CHAT', 'PROFILE', 'EDIT');

-- CreateEnum
CREATE TYPE "achievement_type" AS ENUM ('WEIGHT_KG_LOST', 'FOOD_STREAK');

-- CreateTable
CREATE TABLE "measurements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "measurement_kind" NOT NULL,
    "value" DECIMAL(4,1) NOT NULL,
    "local_date" DATE NOT NULL,
    "measured_at" TIMESTAMPTZ NOT NULL,
    "source" "measurement_source" NOT NULL,
    "message_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "achievement_type" NOT NULL,
    "value" INTEGER NOT NULL,
    "achieved_at" TIMESTAMPTZ NOT NULL,
    "message_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "measurements_message_id_idx" ON "measurements"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "measurements_user_id_kind_local_date_key" ON "measurements"("user_id", "kind", "local_date");

-- CreateIndex
CREATE INDEX "achievements_message_id_idx" ON "achievements"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_user_id_type_value_key" ON "achievements"("user_id", "type", "value");

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guard: the backfill copies only the weight itself; refuse to run if it would lose data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "weight_entries" WHERE "note" IS NOT NULL) THEN
    RAISE EXCEPTION 'weight_entries has notes — backfill would lose them';
  END IF;
  IF EXISTS (SELECT 1 FROM "weight_entries" GROUP BY "user_id", "local_date" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'weight_entries has duplicate (user_id, local_date)';
  END IF;
END $$;

-- Backfill: copy weigh-ins from the deprecated weight_entries (kept until the drop migration).
-- (user_id, local_date) is already unique there; DISTINCT ON guards against a duplicate anyway.
INSERT INTO "measurements" ("id", "user_id", "kind", "value", "local_date", "measured_at", "source", "created_at", "updated_at")
SELECT DISTINCT ON ("user_id", "local_date")
  "id", "user_id", 'WEIGHT', round("weight_kg"::numeric, 1), "local_date", "measured_at", 'PROFILE', "created_at", "updated_at"
FROM "weight_entries"
ORDER BY "user_id", "local_date", "measured_at" DESC;
