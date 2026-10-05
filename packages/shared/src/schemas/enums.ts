import { z } from 'zod'

// Mirror of the enums in apps/api/prisma/schema.prisma — keep values in sync.

export const localeSchema = z.enum(['uk', 'pl', 'en'])
export type Locale = z.infer<typeof localeSchema>

export const verificationTokenTypeSchema = z.enum(['EMAIL_VERIFY', 'PASSWORD_RESET'])
export type VerificationTokenType = z.infer<typeof verificationTokenTypeSchema>

export const sexSchema = z.enum(['FEMALE', 'MALE'])
export type Sex = z.infer<typeof sexSchema>

export const activityLevelSchema = z.enum([
	'SEDENTARY',
	'LIGHT',
	'MODERATE',
	'ACTIVE',
	'VERY_ACTIVE',
])
export type ActivityLevel = z.infer<typeof activityLevelSchema>

export const goalTypeSchema = z.enum(['LOSE', 'MAINTAIN', 'GAIN'])
export type GoalType = z.infer<typeof goalTypeSchema>

export const messageRoleSchema = z.enum(['USER', 'ASSISTANT'])
export type MessageRole = z.infer<typeof messageRoleSchema>

export const messageStatusSchema = z.enum(['PENDING', 'STREAMING', 'COMPLETED', 'FAILED'])
export type MessageStatus = z.infer<typeof messageStatusSchema>

export const attachmentStatusSchema = z.enum(['PENDING', 'PROCESSED', 'FAILED'])
export type AttachmentStatus = z.infer<typeof attachmentStatusSchema>

export const aiRunPurposeSchema = z.enum(['PARSE_FOOD', 'CHAT_REPLY', 'SUGGEST_MEAL', 'SUMMARY'])
export type AiRunPurpose = z.infer<typeof aiRunPurposeSchema>

export const aiRunStatusSchema = z.enum(['PENDING', 'SUCCEEDED', 'FAILED'])
export type AiRunStatus = z.infer<typeof aiRunStatusSchema>

export const toolCallStatusSchema = z.enum(['SUCCEEDED', 'REJECTED', 'FAILED'])
export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>

export const clarificationStatusSchema = z.enum(['OPEN', 'ANSWERED', 'DISMISSED'])
export type ClarificationStatus = z.infer<typeof clarificationStatusSchema>

export const mealTypeSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'])
export type MealType = z.infer<typeof mealTypeSchema>

export const foodSourceSchema = z.enum(['LABEL', 'MEMORY', 'REFERENCE', 'ESTIMATE', 'MANUAL'])
export type FoodSource = z.infer<typeof foodSourceSchema>

export const myFoodSourceSchema = z.enum(['LABEL', 'MANUAL', 'AI'])
export type MyFoodSource = z.infer<typeof myFoodSourceSchema>

export const factCategorySchema = z.enum(['PREFERENCE', 'HABIT', 'RESTRICTION', 'OTHER'])
export type FactCategory = z.infer<typeof factCategorySchema>

export const factStatusSchema = z.enum(['PROPOSED', 'CONFIRMED', 'REJECTED'])
export type FactStatus = z.infer<typeof factStatusSchema>

export const exerciseSourceSchema = z.enum(['MANUAL', 'AI_ESTIMATE', 'DEVICE'])
export type ExerciseSource = z.infer<typeof exerciseSourceSchema>
