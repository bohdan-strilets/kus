-- AlterTable
ALTER TABLE "food_entries" ADD COLUMN     "pot_id" UUID,
ADD COLUMN     "recipe_draft" JSONB;

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "source_message_id" UUID;

-- CreateIndex
CREATE INDEX "food_entries_user_id_pot_id_idx" ON "food_entries"("user_id", "pot_id");

-- CreateIndex
CREATE INDEX "recipes_source_message_id_idx" ON "recipes"("source_message_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
