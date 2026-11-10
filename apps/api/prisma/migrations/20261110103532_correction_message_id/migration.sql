-- AlterTable
ALTER TABLE "corrections" ADD COLUMN     "message_id" UUID;

-- CreateIndex
CREATE INDEX "corrections_message_id_idx" ON "corrections"("message_id");

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
