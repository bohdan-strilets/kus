// Today's demo chat: messages → AI runs → meals, a clarification and a correction.
import { randomUUID } from 'node:crypto'

import {
	AiRunPurpose,
	AiRunStatus,
	ClarificationStatus,
	FoodSource,
	MealType,
	MessageRole,
	MessageStatus,
	Prisma,
	ToolCallStatus,
} from '../src/generated/prisma/client'
import { DEMO_AI_MODEL, DEMO_FOODS, type DemoFoodKey } from './seed-data'
import { getLocalDate, getUtcTimeOnLocalDate, scaleMacros } from './seed-utils'

const REPLY_DELAY_MS = 3000
const DEMO_RUN_COST_USD = new Prisma.Decimal('0.00021')

type ChatTurn = { userText: string; assistantText: string; utcHour: number; minute?: number }
type ChatTurnIds = { userMessageId: string; assistantMessageId: string; sentAt: Date }

const createTurn = async (
	tx: Prisma.TransactionClient,
	userId: string,
	turn: ChatTurn,
): Promise<ChatTurnIds> => {
	const sentAt = getUtcTimeOnLocalDate(0, turn.utcHour, turn.minute)
	const userMessage = await tx.message.create({
		data: {
			userId,
			role: MessageRole.USER,
			content: turn.userText,
			status: MessageStatus.COMPLETED,
			clientMessageId: randomUUID(),
			createdAt: sentAt,
		},
	})
	const assistantMessage = await tx.message.create({
		data: {
			userId,
			role: MessageRole.ASSISTANT,
			content: turn.assistantText,
			status: MessageStatus.COMPLETED,
			replyToId: userMessage.id,
			createdAt: new Date(Math.min(sentAt.getTime() + REPLY_DELAY_MS, Date.now())),
		},
	})
	return { userMessageId: userMessage.id, assistantMessageId: assistantMessage.id, sentAt }
}

const logAiRun = async (
	tx: Prisma.TransactionClient,
	userId: string,
	messageId: string,
	toolCalls: { name: string; input: Prisma.InputJsonValue }[],
): Promise<void> => {
	await tx.aiRun.create({
		data: {
			userId,
			messageId,
			purpose: AiRunPurpose.PARSE_FOOD,
			model: DEMO_AI_MODEL,
			inputTokens: 1200,
			outputTokens: 180,
			costUsd: DEMO_RUN_COST_USD,
			durationMs: 1800,
			status: AiRunStatus.SUCCEEDED,
			toolCalls: {
				create: toolCalls.map((call) => ({
					...call,
					result: { ok: true },
					status: ToolCallStatus.SUCCEEDED,
				})),
			},
		},
	})
}

export const seedTodayChat = async (
	tx: Prisma.TransactionClient,
	userId: string,
	foodIds: Record<DemoFoodKey, string>,
): Promise<void> => {
	const today = getLocalDate(0)

	const breakfast = await createTurn(tx, userId, {
		userText: 'На сніданок грецький йогурт і банан',
		assistantText: 'Записав сніданок: йогурт 150 г і банан. Смачного!',
		utcHour: 6,
	})
	await logAiRun(tx, userId, breakfast.userMessageId, [
		{ name: 'log_food', input: { items: ['Грецький йогурт 2%', 'Банан'] } },
	])
	await tx.meal.create({
		data: {
			userId,
			type: MealType.BREAKFAST,
			eatenAt: breakfast.sentAt,
			localDate: today,
			sourceMessageId: breakfast.userMessageId,
			entries: {
				createMany: {
					data: (
						[
							{ food: 'yogurt', grams: 150, quantity: null },
							{ food: 'banana', grams: 120, quantity: 1 },
						] as const
					).map(({ food, grams, quantity }) => ({
						userId,
						name: DEMO_FOODS[food].name,
						grams,
						quantity,
						...scaleMacros(DEMO_FOODS[food].per100g, grams / 100),
						source: FoodSource.MEMORY,
						confidence: 0.95,
						myFoodId: foodIds[food],
					})),
				},
			},
		},
	})

	const lunch = await createTurn(tx, userId, {
		userText: 'Паста з куркою на обід, тарілка десь 300 г',
		assistantText: 'Записав пасту з куркою ~300 г, це приблизно 450 ккал. Скільки олії додавали?',
		utcHour: 10,
	})
	await logAiRun(tx, userId, lunch.userMessageId, [
		{ name: 'log_food', input: { items: ['Паста з куркою'] } },
		{ name: 'clarify', input: { question: 'oil' } },
	])
	const lunchMeal = await tx.meal.create({
		data: {
			userId,
			type: MealType.LUNCH,
			eatenAt: lunch.sentAt,
			localDate: today,
			sourceMessageId: lunch.userMessageId,
		},
	})
	const pasta = await tx.foodEntry.create({
		data: {
			userId,
			mealId: lunchMeal.id,
			name: 'Паста з куркою',
			grams: 300,
			kcal: 450,
			proteinG: 32,
			fatG: 8,
			carbsG: 62,
			fiberG: 3,
			source: FoodSource.ESTIMATE,
			confidence: 0.5,
			assumption: 'Тарілка ~300 г, без олії',
		},
	})

	const answer = await createTurn(tx, userId, {
		userText: '1 ложку',
		assistantText: 'Дякую! Додав 1 ст. л. олії — обід тепер ~570 ккал.',
		utcHour: 10,
		minute: 2,
	})
	await logAiRun(tx, userId, answer.userMessageId, [
		{ name: 'log_food', input: { entryId: pasta.id, oilTbsp: 1 } },
	])
	// the answer refines the estimate: +1 tbsp oil (~13.6 g fat, ~120 kcal)
	await tx.foodEntry.update({
		where: { id: pasta.id },
		data: { kcal: 570, fatG: 21.6, confidence: 0.7, assumption: 'Тарілка ~300 г, 1 ст. л. олії' },
	})
	await tx.clarification.create({
		data: {
			userId,
			messageId: lunch.assistantMessageId,
			answerMessageId: answer.userMessageId,
			question: 'Скільки олії додавали в пасту?',
			options: ['Без олії', '1 ст. л.', '2 ст. л.'],
			impactKcal: 120,
			status: ClarificationStatus.ANSWERED,
			answer: '1 ст. л.',
			answeredAt: answer.sentAt,
			entries: { create: { foodEntryId: pasta.id } },
		},
	})

	const correction = await createTurn(tx, userId, {
		userText: 'Вчора на вечерю курки було 150 г, не 120',
		assistantText: 'Виправив: вчора курка 150 г.',
		utcHour: 10,
		minute: 5,
	})
	const chickenEntry = await tx.foodEntry.findFirstOrThrow({
		where: {
			userId,
			myFoodId: foodIds.chicken,
			meal: { localDate: getLocalDate(1), type: MealType.DINNER },
		},
	})
	await tx.foodEntry.update({ where: { id: chickenEntry.id }, data: { isEdited: true } })
	await tx.correction.create({
		data: {
			userId,
			foodEntryId: chickenEntry.id,
			before: { grams: 120, kcal: 132 },
			after: { grams: chickenEntry.grams, kcal: chickenEntry.kcal },
			myFoodId: foodIds.chicken,
			createdAt: correction.sentAt,
		},
	})

	const runCount = await tx.aiRun.count({ where: { userId } })
	await tx.dailyUsage.create({
		data: {
			userId,
			localDate: today,
			messageCount: await tx.message.count({ where: { userId, role: MessageRole.USER } }),
			photoCount: 0,
			aiCostUsd: DEMO_RUN_COST_USD.mul(runCount),
		},
	})
}
