-- CreateEnum
CREATE TYPE "muscle_group" AS ENUM ('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'CORE');

-- AlterTable
ALTER TABLE "exercise_entries" ADD COLUMN     "muscle_group" "muscle_group";

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "muscle_group" "muscle_group";

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "finished_at" TIMESTAMPTZ,
ADD COLUMN     "finished_message_id" UUID;

-- CreateIndex
CREATE INDEX "workouts_finished_message_id_idx" ON "workouts"("finished_message_id");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_finished_message_id_fkey" FOREIGN KEY ("finished_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: workouts logged before 0.10.0 were one message each and their card was already the summary
UPDATE "workouts" SET "finished_message_id" = "source_message_id", "finished_at" = "created_at" WHERE "finished_at" IS NULL;
