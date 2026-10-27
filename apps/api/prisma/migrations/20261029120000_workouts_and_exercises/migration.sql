-- exercise_entries changes its meaning (an exercise of a workout): refuse to run over rows, over
-- manual copies of the new objects, or twice. Check on prod before deploy: SELECT count(*) FROM exercise_entries.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM exercise_entries) THEN
    RAISE EXCEPTION 'exercise_entries is not empty: review before repurposing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname IN ('workout_place', 'exercise_kind')) THEN
    RAISE EXCEPTION 'type workout_place or exercise_kind already exists — a manual change; reconcile it before applying this migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name IN ('workouts', 'exercises', 'exercise_sets')
  ) THEN
    RAISE EXCEPTION 'workouts, exercises or exercise_sets already exists — a manual change; reconcile it before applying this migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'exercise_entries'
      AND column_name IN ('workout_id', 'exercise_id', 'kind', 'position', 'distance_m')
  ) THEN
    RAISE EXCEPTION 'exercise_entries already has a new column — a manual change; reconcile it before applying this migration';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "workout_place" AS ENUM ('GYM', 'HOME', 'OUTDOOR', 'OTHER');

-- CreateEnum
CREATE TYPE "exercise_kind" AS ENUM ('STRENGTH', 'CARDIO', 'OTHER');

-- AlterTable
ALTER TABLE "exercise_entries" ADD COLUMN     "distance_m" INTEGER,
ADD COLUMN     "exercise_id" UUID,
ADD COLUMN     "kind" "exercise_kind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workout_id" UUID,
ALTER COLUMN "duration_min" DROP NOT NULL,
ALTER COLUMN "kcal_burned" DROP NOT NULL;

-- CreateTable
CREATE TABLE "workouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "started_at" TIMESTAMPTZ,
    "duration_min" INTEGER,
    "place" "workout_place",
    "kcal_burned" INTEGER,
    "kcal_source" "exercise_source",
    "note" TEXT,
    "source_message_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "aliases" TEXT[],
    "kind" "exercise_kind" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_sets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exercise_entry_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "reps" INTEGER,
    "weight_kg" DECIMAL(6,2),
    "duration_sec" INTEGER,
    "distance_m" INTEGER,
    "is_warmup" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "exercise_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workouts_user_id_local_date_idx" ON "workouts"("user_id", "local_date");

-- CreateIndex
CREATE INDEX "workouts_source_message_id_idx" ON "workouts"("source_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_user_id_name_normalized_key" ON "exercises"("user_id", "name_normalized") WHERE deleted_at IS NULL;

-- CreateIndex
CREATE INDEX "exercise_sets_user_id_exercise_entry_id_idx" ON "exercise_sets"("user_id", "exercise_entry_id");

-- CreateIndex
CREATE INDEX "exercise_entries_workout_id_idx" ON "exercise_entries"("workout_id");

-- CreateIndex
CREATE INDEX "exercise_entries_exercise_id_idx" ON "exercise_entries"("exercise_id");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_exercise_entry_id_fkey" FOREIGN KEY ("exercise_entry_id") REFERENCES "exercise_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
