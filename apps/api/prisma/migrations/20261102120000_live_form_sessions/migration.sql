-- AlterTable
ALTER TABLE "exercise_entries" ADD COLUMN     "client_key" UUID,
ADD COLUMN     "is_bodyweight" BOOLEAN,
ADD COLUMN     "template_exercise_id" UUID;

-- AlterTable
ALTER TABLE "exercise_sets" ADD COLUMN     "done_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "is_bodyweight" BOOLEAN;

-- AlterTable
ALTER TABLE "template_exercises" ADD COLUMN     "is_bodyweight" BOOLEAN;

-- CreateIndex
CREATE INDEX "exercise_entries_template_exercise_id_idx" ON "exercise_entries"("template_exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_entries_workout_id_client_key_key" ON "exercise_entries"("workout_id", "client_key");

-- CreateIndex
-- One open live session per user (a partial index, declared in schema.prisma with `where: raw(...)`)
CREATE UNIQUE INDEX "workouts_one_open_live" ON "workouts"("user_id") WHERE (source = 'LIVE' AND finished_at IS NULL AND deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_template_exercise_id_fkey" FOREIGN KEY ("template_exercise_id") REFERENCES "template_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
