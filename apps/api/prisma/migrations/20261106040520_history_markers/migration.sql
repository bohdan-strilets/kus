-- AlterTable
ALTER TABLE "my_foods" ADD COLUMN     "source_message_id" UUID;

-- AlterTable
ALTER TABLE "user_facts" ADD COLUMN     "answered_at" TIMESTAMPTZ,
ADD COLUMN     "confirmed_message_id" UUID;

-- CreateIndex
CREATE INDEX "my_foods_source_message_id_idx" ON "my_foods"("source_message_id");

-- CreateIndex
CREATE INDEX "user_facts_confirmed_message_id_idx" ON "user_facts"("confirmed_message_id");

-- AddForeignKey
ALTER TABLE "my_foods" ADD CONSTRAINT "my_foods_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_confirmed_message_id_fkey" FOREIGN KEY ("confirmed_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
