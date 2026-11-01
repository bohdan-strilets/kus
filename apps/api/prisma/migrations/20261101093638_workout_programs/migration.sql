-- CreateEnum
CREATE TYPE "program_mode" AS ENUM ('ROTATE', 'SINGLE', 'WEEKDAYS');

-- CreateEnum
CREATE TYPE "workout_source" AS ENUM ('CHAT', 'LIVE', 'FORM');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "program_card" JSONB;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "training_onboarding_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "source" "workout_source" NOT NULL DEFAULT 'CHAT',
ADD COLUMN     "template_id" UUID;

-- CreateTable
CREATE TABLE "workout_programs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "mode" "program_mode" NOT NULL DEFAULT 'ROTATE',
    "per_week" INTEGER,
    "active_version_id" UUID,
    "pinned_template_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "workout_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_versions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "source_message_id" UUID,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_templates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_exercises" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "exercise_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "exercise_kind" NOT NULL,
    "muscle_group" "muscle_group",
    "position" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps_min" INTEGER,
    "reps_max" INTEGER,
    "weight_kg" DECIMAL(6,2),
    "progress_step_kg" DECIMAL(4,2),
    "rest_sec" INTEGER,
    "duration_min" INTEGER,
    "distance_m" INTEGER,

    CONSTRAINT "template_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_programs_active_version_id_key" ON "workout_programs"("active_version_id");

-- CreateIndex
CREATE INDEX "workout_programs_pinned_template_id_idx" ON "workout_programs"("pinned_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "workout_programs_one_active_per_user" ON "workout_programs"("user_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "program_versions_source_message_id_key" ON "program_versions"("source_message_id");

-- CreateIndex
CREATE INDEX "program_versions_program_id_created_at_idx" ON "program_versions"("program_id", "created_at");

-- CreateIndex
CREATE INDEX "workout_templates_user_id_idx" ON "workout_templates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workout_templates_version_id_key_key" ON "workout_templates"("version_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "workout_templates_version_id_position_key" ON "workout_templates"("version_id", "position");

-- CreateIndex
CREATE INDEX "template_exercises_exercise_id_idx" ON "template_exercises"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_exercises_template_id_position_key" ON "template_exercises"("template_id", "position");

-- CreateIndex
CREATE INDEX "messages_program_card_idx" ON "messages"("user_id", "created_at") WHERE (program_card IS NOT NULL);

-- CreateIndex
CREATE INDEX "workouts_template_id_idx" ON "workouts"("template_id");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_programs" ADD CONSTRAINT "workout_programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_programs" ADD CONSTRAINT "workout_programs_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "program_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_programs" ADD CONSTRAINT "workout_programs_pinned_template_id_fkey" FOREIGN KEY ("pinned_template_id") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "workout_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
