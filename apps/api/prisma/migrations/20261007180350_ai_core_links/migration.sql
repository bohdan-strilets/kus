-- AlterTable
ALTER TABLE "food_entries" ADD COLUMN     "source_message_id" UUID;

-- CreateIndex
CREATE INDEX "ai_tool_calls_created_at_idx" ON "ai_tool_calls"("created_at");

-- CreateIndex
CREATE INDEX "food_entries_source_message_id_idx" ON "food_entries"("source_message_id");

-- AddForeignKey
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
