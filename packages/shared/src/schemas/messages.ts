import { z } from 'zod'

import { AI_IMAGE_MIME_TYPES } from '../ai/context.js'
import { clarifyOptionSchema } from '../ai/tools.js'
import { achievementResponseSchema } from './achievements.js'
import {
	attachmentStatusSchema,
	clarificationStatusSchema,
	foodCategorySchema,
	foodSourceSchema,
	mealTypeSchema,
	messageRoleSchema,
	messageStatusSchema,
} from './enums.js'
import { dayVerdictSchema } from './day-verdict.js'
import { measurementCardSchema } from './measurements.js'
import { PHOTOS_PER_MESSAGE_LIMIT } from './photo-limits.js'
import { statsCardSchema } from './stats-card.js'
import { workoutResponseSchema } from './workouts.js'

export const MESSAGE_TEXT_MAX_LENGTH = 2000
export const MESSAGES_PAGE_DEFAULT_LIMIT = 30
export const MESSAGES_PAGE_MAX_LIMIT = 50
const CURSOR_MAX_LENGTH = 200

/** The client sends a JPEG of at most ~1 MB; the server accepts a bit more and refuses the rest. */
export const PHOTO_MAX_BYTES = 1_400_000
/** The longest side the model prices sensibly: above it the image costs more tokens for no gain. */
export const PHOTO_MAX_SIDE_PX = 2576
export const PHOTO_MIN_SIDE_PX = 64
const BASE64_CHARS_PER_GROUP = 4
const BYTES_PER_BASE64_GROUP = 3
export const PHOTO_MAX_BASE64_LENGTH =
	Math.ceil(PHOTO_MAX_BYTES / BYTES_PER_BASE64_GROUP) * BASE64_CHARS_PER_GROUP

export const TEXT_OR_PHOTO_REQUIRED = 'TEXT_OR_PHOTO_REQUIRED'

export const sendMessagePhotoSchema = z.object({
	mimeType: z.enum(AI_IMAGE_MIME_TYPES),
	data: z.base64().max(PHOTO_MAX_BASE64_LENGTH),
})

export type SendMessagePhoto = z.infer<typeof sendMessagePhotoSchema>

export const PHOTO_AND_PHOTO_IDS_EXCLUSIVE = 'PHOTO_AND_PHOTO_IDS_EXCLUSIVE'

/**
 * Body of POST /messages: words, photos, or both. `clientMessageId` makes a resend (double tap,
 * "Спробувати ще") idempotent. A blank text counts as no text. Photos come either inline (`photo`,
 * the old single-photo way) or as ids of earlier POST /photos uploads (`photoIds`) — not both.
 * The env PHOTOS_PER_MESSAGE_MAX may lower the `photoIds` ceiling; the API checks that itself.
 */
export const sendMessageRequestSchema = z
	.object({
		clientMessageId: z.uuid(),
		text: z
			.string()
			.trim()
			.max(MESSAGE_TEXT_MAX_LENGTH)
			.optional()
			.transform((text) => (text === '' ? undefined : text)),
		photo: sendMessagePhotoSchema.optional(),
		photoIds: z.array(z.uuid()).min(1).max(PHOTOS_PER_MESSAGE_LIMIT).optional(),
	})
	.refine(
		(request) =>
			request.text !== undefined || request.photo !== undefined || request.photoIds !== undefined,
		{ message: TEXT_OR_PHOTO_REQUIRED },
	)
	.refine((request) => request.photo === undefined || request.photoIds === undefined, {
		message: PHOTO_AND_PHOTO_IDS_EXCLUSIVE,
		path: ['photoIds'],
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
	/** `YYYY-MM-DD` of the entry this one was copied from («як вчора»); null for anything else. */
	copiedFromDate: z.iso.date().nullable().default(null),
	/** The «Без деталей» estimate written by closing a day. */
	isUndetailed: z.boolean().default(false),
	/** No saved food is linked yet: the «Запам'ятати» button shows. An old API without the field = false = hidden. */
	canRemember: z.boolean().default(false),
})

export type FoodEntryResponse = z.infer<typeof foodEntryResponseSchema>

/**
 * A meal as a card shows it: in the chat — the entries added by this message, on «Сьогодні» — all
 * of them. `totals` always sum exactly the `entries` shown.
 */
export const loggedMealSchema = z.object({
	id: z.uuid(),
	type: mealTypeSchema,
	/** `YYYY-MM-DD`, the user's calendar day. */
	localDate: z.iso.date(),
	/** When the meal was eaten: the typical time of a named earlier meal, else the moment it was logged. */
	eatenAt: z.iso.datetime(),
	totals: nutritionTotalsSchema,
	/** kcal of the whole meal when it also holds entries of other messages («Вечеря разом»); else null. */
	mealTotalKcal: z.number().nullable(),
	entries: z.array(foodEntryResponseSchema),
})

export type LoggedMeal = z.infer<typeof loggedMealSchema>

/** What the chat shows of an answer; the full values stay on the backend. */
export const clarifyOptionViewSchema = clarifyOptionSchema.pick({ label: true, kcal: true })

export type ClarifyOptionView = z.infer<typeof clarifyOptionViewSchema>

export const clarificationResponseSchema = z.object({
	id: z.uuid(),
	question: z.string(),
	options: z.array(clarifyOptionViewSchema),
	impactKcal: z.number().nullable(),
	status: clarificationStatusSchema,
	/** The tapped option once ANSWERED by a tap; null while open or answered in words. */
	answeredOptionIndex: z.int().nonnegative().nullable(),
	/** The tapped option's label or the user's words; null while open. */
	answer: z.string().nullable(),
	entryIds: z.array(z.uuid()),
})

export type ClarificationResponse = z.infer<typeof clarificationResponseSchema>

export const chatMessagePhotoSchema = z.object({
	fileId: z.uuid().nullable(),
	width: z.int().positive(),
	height: z.int().positive(),
	status: attachmentStatusSchema,
	position: z.int().nonnegative(),
})

export type ChatMessagePhoto = z.infer<typeof chatMessagePhotoSchema>

// Raising it breaks dayCard parsing in an old web: ship in two deploys, first a web that
// understands both versions, then the api.
export const DAY_CARD_VERSION = 1

export const dayCardKindSchema = z.enum(['today', 'past', 'planned'])

export type DayCardKind = z.infer<typeof dayCardKindSchema>

const dayCardMacrosSchema = z.object({
	kcal: z.number(),
	protein: z.number(),
	fat: z.number(),
	carbs: z.number(),
})

/**
 * A day as Kusik showed it when answering show_day: a snapshot, the numbers are not refreshed after
 * later edits. All of it is counted by the backend; the model only names the day.
 */
export const dayCardSchema = z.object({
	version: z.literal(DAY_CARD_VERSION),
	/** `YYYY-MM-DD`, the user's calendar day. */
	localDate: z.iso.date(),
	kind: dayCardKindSchema,
	/** When the snapshot was taken, for `today` only: the day is still going. */
	asOf: z.iso.datetime().nullable(),
	totals: dayCardMacrosSchema,
	goal: dayCardMacrosSchema.nullable(),
	/** Goal kcal − eaten kcal, negative when over; null without a goal. */
	remainingKcal: z.number().nullable(),
	meals: z.array(
		z.object({
			type: mealTypeSchema,
			eatenAt: z.iso.datetime().nullable(),
			kcal: z.number(),
			/** The meal holds the «Без деталей» estimate of a closed day. */
			hasUndetailed: z.boolean().default(false),
		}),
	),
	/**
	 * How the day went against the goal; absent in snapshots written before 0.7.0 and for a planned
	 * day. The old kinds stay as they are — this is a separate field.
	 */
	verdict: dayVerdictSchema.optional(),
	/** The card answers close_day (the user closed the day), not a plain look at it. */
	isClosing: z.boolean().optional(),
})

export type DayCard = z.infer<typeof dayCardSchema>

export const chatMessageSchema = z.object({
	id: z.uuid(),
	role: messageRoleSchema,
	content: z.string().nullable(),
	status: messageStatusSchema,
	clientMessageId: z.string().nullable(),
	/**
	 * The user message an assistant reply answers. null on an assistant message = Kusik wrote it on
	 * his own (today only the welcome back after account-restore); a second kind of such message
	 * needs an explicit field, not this null.
	 */
	replyToId: z.uuid().nullable(),
	createdAt: z.iso.datetime(),
	/** User messages only: how the photo went (FAILED = not food or unreadable); the file itself is in `photos`. */
	photo: z.object({ status: attachmentStatusSchema }).nullable(),
	/**
	 * User messages only: the stored photos in grid order. `fileId` is null once the file is gone.
	 * Optional while the API still returns only `photo`, so it compiles and old payloads still parse.
	 */
	photos: z.array(chatMessagePhotoSchema).optional(),
	/** Assistant replies only: what this turn logged, one card per meal (a whole day → several). */
	meals: z.array(loggedMealSchema),
	clarifications: z.array(clarificationResponseSchema),
	/** Assistant replies only: the weight or waist this turn recorded, one card per kind. */
	measurements: z.array(measurementCardSchema),
	/** Assistant replies only: the trainings this turn recorded (empty in payloads of older servers). */
	workouts: z.array(workoutResponseSchema).default([]),
	/** Assistant replies only: the milestone this turn reached — the highest one per type. */
	achievements: z.array(achievementResponseSchema),
	/** Replies to show_day only: the day snapshot. null elsewhere and in payloads of older servers. */
	dayCard: dayCardSchema.nullable().default(null),
	/**
	 * Replies to show_stats only: the period snapshot. null elsewhere, in payloads of older servers
	 * and when the card cannot be read (the message stays, with its reply text).
	 */
	statsCard: statsCardSchema.nullable().default(null).catch(null),
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
	/**
	 * Earlier replies whose cards or questions this turn changed (an entry corrected, deleted or
	 * restored, a question answered in words), as they are now. Empty on a replayed turn.
	 */
	updatedMessages: z.array(chatMessageSchema),
})

export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>
