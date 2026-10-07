import {
	activityLevelSchema,
	aiRunPurposeSchema,
	aiRunStatusSchema,
	attachmentStatusSchema,
	clarificationStatusSchema,
	exerciseSourceSchema,
	factCategorySchema,
	factStatusSchema,
	foodCategorySchema,
	foodSourceSchema,
	goalTypeSchema,
	localeSchema,
	mealTypeSchema,
	messageRoleSchema,
	messageStatusSchema,
	myFoodSourceSchema,
	sexSchema,
	toolCallStatusSchema,
	verificationTokenTypeSchema,
} from '@kus/shared'
import { describe, expect, it } from 'vitest'

import * as PrismaEnums from '../generated/prisma/enums'

// Shared zod enums must match the Prisma schema, or values pass validation and fail on insert
const ENUM_PAIRS: [string, Record<string, string>, readonly string[]][] = [
	['Locale', PrismaEnums.Locale, localeSchema.options],
	['VerificationTokenType', PrismaEnums.VerificationTokenType, verificationTokenTypeSchema.options],
	['Sex', PrismaEnums.Sex, sexSchema.options],
	['ActivityLevel', PrismaEnums.ActivityLevel, activityLevelSchema.options],
	['GoalType', PrismaEnums.GoalType, goalTypeSchema.options],
	['MessageRole', PrismaEnums.MessageRole, messageRoleSchema.options],
	['MessageStatus', PrismaEnums.MessageStatus, messageStatusSchema.options],
	['AttachmentStatus', PrismaEnums.AttachmentStatus, attachmentStatusSchema.options],
	['AiRunPurpose', PrismaEnums.AiRunPurpose, aiRunPurposeSchema.options],
	['AiRunStatus', PrismaEnums.AiRunStatus, aiRunStatusSchema.options],
	['ToolCallStatus', PrismaEnums.ToolCallStatus, toolCallStatusSchema.options],
	['ClarificationStatus', PrismaEnums.ClarificationStatus, clarificationStatusSchema.options],
	['MealType', PrismaEnums.MealType, mealTypeSchema.options],
	['FoodSource', PrismaEnums.FoodSource, foodSourceSchema.options],
	['MyFoodSource', PrismaEnums.MyFoodSource, myFoodSourceSchema.options],
	['FactCategory', PrismaEnums.FactCategory, factCategorySchema.options],
	['FactStatus', PrismaEnums.FactStatus, factStatusSchema.options],
	['ExerciseSource', PrismaEnums.ExerciseSource, exerciseSourceSchema.options],
	['FoodCategory', PrismaEnums.FoodCategory, foodCategorySchema.options],
]

describe('shared zod enums ↔ Prisma enums', () => {
	it.each(ENUM_PAIRS)('%s has the same values', (_name, prismaEnum, zodOptions) => {
		expect([...zodOptions]).toEqual(Object.values(prismaEnum))
	})

	it('covers every Prisma enum', () => {
		expect(ENUM_PAIRS.map(([name]) => name).sort()).toEqual(Object.keys(PrismaEnums).sort())
	})
})
