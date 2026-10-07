import { z } from 'zod'

import { clarifyOptionSchema } from '../ai/tools.js'
import {
	clarificationStatusSchema,
	foodCategorySchema,
	foodSourceSchema,
	mealTypeSchema,
	messageRoleSchema,
	messageStatusSchema,
} from './enums.js'

export const MESSAGE_TEXT_MAX_LENGTH = 2000
export const MESSAGES_PAGE_DEFAULT_LIMIT = 30
export const MESSAGES_PAGE_MAX_LIMIT = 50
const CURSOR_MAX_LENGTH = 200

/** Body of POST /messages. `clientMessageId` makes a resend (double tap, "Спробувати ще") idempotent. */
export const sendMessageRequestSchema = z.object({
	clientMessageId: z.uuid(),
	text: z.string().trim().min(1).max(MESSAGE_TEXT_MAX_LENGTH),
})

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>

export const listMessagesQuerySchema = z.object({
	cursor: z.string().min(1).max(CURSOR_MAX_LENGTH).optional(),
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(MESSAGES_PAGE_MAX_LIMIT)
		.default(MESSAGES_PAGE_DEFAULT_LIMIT),
})

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>

export const nutritionTotalsSchema = z.object({
	kcal: z.number(),
	protein: z.number(),
	fat: z.number(),
	carbs: z.number(),
	fiber: z.number(),
})

export type NutritionTotals = z.infer<typeof nutritionTotalsSchema>

export const foodEntryResponseSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	grams: z.number(),
	quantity: z.number().nullable(),
	kcal: z.number(),
	protein: z.number(),
	fat: z.number(),
	carbs: z.number(),
	fiber: z.number().nullable(),
	category: foodCategorySchema,
	source: foodSourceSchema,
	confidence: z.number(),
	assumption: z.string().nullable(),
	isEdited: z.boolean(),
})

export type FoodEntryResponse = z.infer<typeof foodEntryResponseSchema>

/** A meal as the chat card shows it: totals of the whole meal, entries added by this message. */
export const loggedMealSchema = z.object({
	id: z.uuid(),
	type: mealTypeSchema,
	/** `YYYY-MM-DD`, the user's calendar day. */
	localDate: z.iso.date(),
	totals: nutritionTotalsSchema,
	entries: z.array(foodEntryResponseSchema),
})

export type LoggedMeal = z.infer<typeof loggedMealSchema>

export const clarificationResponseSchema = z.object({
	id: z.uuid(),
	question: z.string(),
	options: z.array(clarifyOptionSchema),
	impactKcal: z.number().nullable(),
	status: clarificationStatusSchema,
	entryIds: z.array(z.uuid()),
})

export type ClarificationResponse = z.infer<typeof clarificationResponseSchema>

export const chatMessageSchema = z.object({
	id: z.uuid(),
	role: messageRoleSchema,
	content: z.string().nullable(),
	status: messageStatusSchema,
	clientMessageId: z.string().nullable(),
	replyToId: z.uuid().nullable(),
	createdAt: z.iso.datetime(),
	/** Assistant replies only: what this turn logged. */
	meal: loggedMealSchema.nullable(),
	clarifications: z.array(clarificationResponseSchema),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>

export const dayTotalsSchema = z.object({
	localDate: z.iso.date(),
	totals: nutritionTotalsSchema,
	goalKcal: z.number().nullable(),
	/** Negative when over the goal; null without a goal. */
	remainingKcal: z.number().nullable(),
})

export type DayTotals = z.infer<typeof dayTotalsSchema>

/** `data` of POST /messages. */
export const sendMessageResponseSchema = z.object({
	userMessage: chatMessageSchema,
	assistantMessage: chatMessageSchema,
	dayTotals: dayTotalsSchema,
})

export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>
