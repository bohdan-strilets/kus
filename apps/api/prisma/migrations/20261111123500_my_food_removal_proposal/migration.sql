-- AlterTable
ALTER TABLE "my_foods" ADD COLUMN     "removal_proposed_message_id" UUID;

-- CreateIndex
CREATE INDEX "my_foods_removal_proposed_message_id_idx" ON "my_foods"("removal_proposed_message_id");

-- AddForeignKey
ALTER TABLE "my_foods" ADD CONSTRAINT "my_foods_removal_proposed_message_id_fkey" FOREIGN KEY ("removal_proposed_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
