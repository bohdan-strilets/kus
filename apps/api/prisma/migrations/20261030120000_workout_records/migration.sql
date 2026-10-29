-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "edited_at" TIMESTAMPTZ,
ADD COLUMN     "records" JSONB;
