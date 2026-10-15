-- Guard first, so a refusal leaves nothing changed: refuse to drop storage_key (at the end) while any attachment
-- still points at an original. The column was never written (originals were not stored), so a non-null value
-- means data that would be lost silently.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "message_attachments" WHERE "storage_key" IS NOT NULL) THEN
    RAISE EXCEPTION 'message_attachments has rows with storage_key set — refusing to drop the column; move those originals into stored_files first';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "stored_file_kind" AS ENUM ('MESSAGE_PHOTO');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "stored_file_kind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "thumb_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "thumb_size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");

-- CreateIndex
CREATE INDEX "stored_files_user_id_created_at_idx" ON "stored_files"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "stored_files_kind_created_at_idx" ON "stored_files"("kind", "created_at");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "message_attachments" ADD COLUMN     "file_id" UUID,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "message_attachments_file_id_key" ON "message_attachments"("file_id");

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "message_attachments" DROP COLUMN "storage_key";
