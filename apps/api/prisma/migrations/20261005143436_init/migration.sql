-- CreateEnum
CREATE TYPE "locale" AS ENUM ('uk', 'pl', 'en');

-- CreateEnum
CREATE TYPE "verification_token_type" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "sex" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "activity_level" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "goal_type" AS ENUM ('LOSE', 'MAINTAIN', 'GAIN');

-- CreateEnum
CREATE TYPE "message_role" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "attachment_status" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ai_run_purpose" AS ENUM ('PARSE_FOOD', 'CHAT_REPLY', 'SUGGEST_MEAL', 'SUMMARY');

-- CreateEnum
CREATE TYPE "ai_run_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "tool_call_status" AS ENUM ('SUCCEEDED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "clarification_status" AS ENUM ('OPEN', 'ANSWERED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "meal_type" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER');

-- CreateEnum
CREATE TYPE "food_source" AS ENUM ('LABEL', 'MEMORY', 'REFERENCE', 'ESTIMATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "my_food_source" AS ENUM ('LABEL', 'MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "fact_category" AS ENUM ('PREFERENCE', 'HABIT', 'RESTRICTION', 'OTHER');

-- CreateEnum
CREATE TYPE "fact_status" AS ENUM ('PROPOSED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "exercise_source" AS ENUM ('MANUAL', 'AI_ESTIMATE', 'DEVICE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "locale" "locale" NOT NULL DEFAULT 'uk',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw',
    "email_verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_credentials" (
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "password_changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auth_credentials_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "token_family" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "verification_token_type" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "height_cm" DOUBLE PRECISION,
    "birth_year" INTEGER,
    "sex" "sex",
    "activity_level" "activity_level",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "goal_type" NOT NULL,
    "target_weight_kg" DOUBLE PRECISION,
    "daily_kcal" DOUBLE PRECISION NOT NULL,
    "protein_g" DOUBLE PRECISION NOT NULL,
    "fat_g" DOUBLE PRECISION NOT NULL,
    "carbs_g" DOUBLE PRECISION NOT NULL,
    "valid_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "measured_at" TIMESTAMPTZ NOT NULL,
    "local_date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "weight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "message_role" NOT NULL,
    "content" TEXT,
    "status" "message_status" NOT NULL,
    "client_message_id" TEXT,
    "reply_to_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "attachment_status" NOT NULL,
    "storage_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message_id" UUID,
    "purpose" "ai_run_purpose" NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "status" "ai_run_status" NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_calls" (
    "id" UUID NOT NULL,
    "ai_run_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB,
    "status" "tool_call_status" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "answer_message_id" UUID,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "impact_kcal" DOUBLE PRECISION,
    "status" "clarification_status" NOT NULL DEFAULT 'OPEN',
    "answer" TEXT,
    "answered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clarifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarification_entries" (
    "clarification_id" UUID NOT NULL,
    "food_entry_id" UUID NOT NULL,

    CONSTRAINT "clarification_entries_pkey" PRIMARY KEY ("clarification_id","food_entry_id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "meal_type" NOT NULL,
    "eaten_at" TIMESTAMPTZ NOT NULL,
    "local_date" DATE NOT NULL,
    "source_message_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "meal_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein_g" DOUBLE PRECISION NOT NULL,
    "fat_g" DOUBLE PRECISION NOT NULL,
    "carbs_g" DOUBLE PRECISION NOT NULL,
    "fiber_g" DOUBLE PRECISION,
    "source" "food_source" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "assumption" TEXT,
    "my_food_id" UUID,
    "recipe_id" UUID,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "food_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "my_foods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brand" TEXT,
    "barcode" TEXT,
    "kcal_per_100g" DOUBLE PRECISION NOT NULL,
    "protein_per_100g" DOUBLE PRECISION NOT NULL,
    "fat_per_100g" DOUBLE PRECISION NOT NULL,
    "carbs_per_100g" DOUBLE PRECISION NOT NULL,
    "fiber_per_100g" DOUBLE PRECISION,
    "piece_grams" DOUBLE PRECISION,
    "default_grams" DOUBLE PRECISION,
    "source" "my_food_source" NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "my_foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cooked_grams" DOUBLE PRECISION,
    "default_grams" DOUBLE PRECISION,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "my_food_id" UUID,
    "name" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein_g" DOUBLE PRECISION NOT NULL,
    "fat_g" DOUBLE PRECISION NOT NULL,
    "carbs_g" DOUBLE PRECISION NOT NULL,
    "fiber_g" DOUBLE PRECISION,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "food_entry_id" UUID NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "my_food_id" UUID,
    "recipe_id" UUID,
    "saved_to_memory" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_facts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "category" "fact_category" NOT NULL,
    "status" "fact_status" NOT NULL DEFAULT 'PROPOSED',
    "source_message_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "user_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "photo_count" INTEGER NOT NULL DEFAULT 0,
    "ai_cost_usd" DECIMAL(12,8) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "kcal_burned" DOUBLE PRECISION NOT NULL,
    "source" "exercise_source" NOT NULL,
    "performed_at" TIMESTAMPTZ NOT NULL,
    "local_date" DATE NOT NULL,
    "source_message_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "exercise_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_token_family_idx" ON "sessions"("token_family");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "verification_tokens"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "user_goals_user_id_valid_from_key" ON "user_goals"("user_id", "valid_from");

-- CreateIndex
CREATE INDEX "weight_entries_user_id_local_date_idx" ON "weight_entries"("user_id", "local_date");

-- CreateIndex
CREATE INDEX "messages_user_id_created_at_idx" ON "messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_reply_to_id_idx" ON "messages"("reply_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_user_id_client_message_id_key" ON "messages"("user_id", "client_message_id");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "ai_runs_user_id_created_at_idx" ON "ai_runs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_runs_message_id_idx" ON "ai_runs"("message_id");

-- CreateIndex
CREATE INDEX "ai_tool_calls_ai_run_id_idx" ON "ai_tool_calls"("ai_run_id");

-- CreateIndex
CREATE INDEX "clarifications_user_id_status_idx" ON "clarifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "clarifications_message_id_idx" ON "clarifications"("message_id");

-- CreateIndex
CREATE INDEX "clarifications_answer_message_id_idx" ON "clarifications"("answer_message_id");

-- CreateIndex
CREATE INDEX "clarification_entries_food_entry_id_idx" ON "clarification_entries"("food_entry_id");

-- CreateIndex
CREATE INDEX "meals_user_id_local_date_type_idx" ON "meals"("user_id", "local_date", "type");

-- CreateIndex
CREATE INDEX "meals_source_message_id_idx" ON "meals"("source_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "meals_user_id_local_date_type_key" ON "meals"("user_id", "local_date", "type") WHERE (deleted_at IS NULL AND type <> 'OTHER');

-- CreateIndex
CREATE INDEX "food_entries_meal_id_idx" ON "food_entries"("meal_id");

-- CreateIndex
CREATE INDEX "food_entries_user_id_created_at_idx" ON "food_entries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "food_entries_my_food_id_idx" ON "food_entries"("my_food_id");

-- CreateIndex
CREATE INDEX "food_entries_recipe_id_idx" ON "food_entries"("recipe_id");

-- CreateIndex
CREATE INDEX "my_foods_aliases_idx" ON "my_foods" USING GIN ("aliases");

-- CreateIndex
CREATE INDEX "my_foods_user_id_last_used_at_idx" ON "my_foods"("user_id", "last_used_at");

-- CreateIndex
CREATE INDEX "my_foods_user_id_barcode_idx" ON "my_foods"("user_id", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "my_foods_user_id_name_normalized_key" ON "my_foods"("user_id", "name_normalized") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "recipes_aliases_idx" ON "recipes" USING GIN ("aliases");

-- CreateIndex
CREATE INDEX "recipes_user_id_last_used_at_idx" ON "recipes"("user_id", "last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_user_id_name_normalized_key" ON "recipes"("user_id", "name_normalized") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_my_food_id_idx" ON "recipe_ingredients"("my_food_id");

-- CreateIndex
CREATE INDEX "corrections_food_entry_id_idx" ON "corrections"("food_entry_id");

-- CreateIndex
CREATE INDEX "corrections_user_id_created_at_idx" ON "corrections"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "corrections_my_food_id_idx" ON "corrections"("my_food_id");

-- CreateIndex
CREATE INDEX "corrections_recipe_id_idx" ON "corrections"("recipe_id");

-- CreateIndex
CREATE INDEX "user_facts_user_id_status_idx" ON "user_facts"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_facts_source_message_id_idx" ON "user_facts"("source_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_usage_user_id_local_date_key" ON "daily_usage"("user_id", "local_date");

-- CreateIndex
CREATE INDEX "exercise_entries_user_id_local_date_idx" ON "exercise_entries"("user_id", "local_date");

-- CreateIndex
CREATE INDEX "exercise_entries_source_message_id_idx" ON "exercise_entries"("source_message_id");

-- AddForeignKey
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_ai_run_id_fkey" FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_answer_message_id_fkey" FOREIGN KEY ("answer_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_entries" ADD CONSTRAINT "clarification_entries_clarification_id_fkey" FOREIGN KEY ("clarification_id") REFERENCES "clarifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_entries" ADD CONSTRAINT "clarification_entries_food_entry_id_fkey" FOREIGN KEY ("food_entry_id") REFERENCES "food_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_my_food_id_fkey" FOREIGN KEY ("my_food_id") REFERENCES "my_foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "my_foods" ADD CONSTRAINT "my_foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_my_food_id_fkey" FOREIGN KEY ("my_food_id") REFERENCES "my_foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_food_entry_id_fkey" FOREIGN KEY ("food_entry_id") REFERENCES "food_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_my_food_id_fkey" FOREIGN KEY ("my_food_id") REFERENCES "my_foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
