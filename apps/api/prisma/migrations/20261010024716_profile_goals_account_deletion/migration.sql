-- CreateEnum
CREATE TYPE "goal_source" AS ENUM ('CALCULATED', 'MANUAL');

-- DropIndex
DROP INDEX "weight_entries_user_id_local_date_idx";

-- AlterTable
ALTER TABLE "user_goals" ADD COLUMN     "source" "goal_source" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "goal_type" "goal_type",
ADD COLUMN     "pace_kg_per_week" DOUBLE PRECISION,
ADD COLUMN     "target_weight_kg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletion_requested_at" TIMESTAMPTZ,
ADD COLUMN     "purge_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "users_purge_at_idx" ON "users"("purge_at");

-- CreateIndex
CREATE UNIQUE INDEX "weight_entries_user_id_local_date_key" ON "weight_entries"("user_id", "local_date");

