import { Injectable } from '@nestjs/common'
import { AI_TOOL_NAMES, READ_TOOL_NAMES } from '@kus/shared'

import { AiRunPurpose, AiRunStatus, Prisma, ToolCallStatus } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface CreateAiRunData {
	userId: string
	messageId: string | null
	purpose: AiRunPurpose
	model: string
	inputTokens: number
	/** null = the provider did not report it. */
	cachedInputTokens: number | null
	outputTokens: number
	costUsd: number
	durationMs: number
	status: AiRunStatus
	errorCode: string | null
	/** A short technical line for a FAILED run (docs/database.md); never message text. */
	errorDetail?: string | null
	toolCalls: {
		name: string
		input: Prisma.InputJsonValue
		/** What a read tool answered (kept 30 days with the call, like its input). */
		result?: Prisma.InputJsonValue
		status: ToolCallStatus
	}[]
}

export interface ForgetCallRow {
	messageId: string
	aiRunId: string
	runCreatedAt: Date
}

/** forget_food (agreed) and restore_food are the tools that leave a food id in their result. */
export type FoodCallName = typeof AI_TOOL_NAMES.forgetFood | typeof AI_TOOL_NAMES.restoreFood

export interface FoodCallRow {
	messageId: string
	aiRunId: string
	runCreatedAt: Date
	name: FoodCallName
	myFoodId: string
}

export interface ReadCallRow {
	messageId: string
	/** What the read tool stored: `{ text, digest }` for the calls since digests exist. */
	result: Prisma.JsonValue
	createdAt: Date
}

const getStoredFoodId = (result: Prisma.JsonValue): string | null => {
	if (typeof result !== 'object' || result === null || Array.isArray(result)) return null
	const { myFoodId } = result
	return typeof myFoodId === 'string' ? myFoodId : null
}

interface DailyUsageKey {
	userId: string
	localDate: Date
}

export interface DailyUsageLimits {
	messageLimit: number
	photoLimit: number
}

@Injectable()
export class AiRepository {
	constructor(private readonly prisma: PrismaService) {}

	async createRun({ toolCalls, ...data }: CreateAiRunData): Promise<void> {
		await this.prisma.aiRun.create({
			data: { ...data, toolCalls: { create: toolCalls } },
		})
	}

	/**
	 * Counts one AI request (and its photo) against the daily limits. The conditional increment
	 * keeps parallel requests from slipping past a limit; `false` = a limit is used up.
	 */
	async reserveDailyUsage({
		userId,
		localDate,
		hasPhoto,
		messageLimit,
		photoLimit,
	}: DailyUsageKey & DailyUsageLimits & { hasPhoto: boolean }): Promise<boolean> {
		// INSERT ... ON CONFLICT DO NOTHING: two parallel first turns of the day both pass, where
		// upsert (select, then insert) would fail the loser with P2002
		await this.prisma.dailyUsage.createMany({
			data: [{ userId, localDate }],
			skipDuplicates: true,
		})
		const { count } = await this.prisma.dailyUsage.updateMany({
			where: {
				userId,
				localDate,
				messageCount: { lt: messageLimit },
				...(hasPhoto ? { photoCount: { lt: photoLimit } } : {}),
			},
			data: {
				messageCount: { increment: 1 },
				...(hasPhoto ? { photoCount: { increment: 1 } } : {}),
			},
		})
		return count === 1
	}

	/** Whether the photo limit (and not the message one) is what stopped a reservation. */
	async isPhotoLimitUsedUp({
		userId,
		localDate,
		photoLimit,
	}: DailyUsageKey & { photoLimit: number }): Promise<boolean> {
		const usage = await this.prisma.dailyUsage.findUnique({
			where: { userId_localDate: { userId, localDate } },
			select: { photoCount: true },
		})
		return usage !== null && usage.photoCount >= photoLimit
	}

	async addDailyCost({
		userId,
		localDate,
		costUsd,
	}: DailyUsageKey & { costUsd: number }): Promise<void> {
		await this.prisma.dailyUsage.updateMany({
			where: { userId, localDate },
			data: { aiCostUsd: { increment: costUsd } },
		})
	}

	/**
	 * The successful forget_fact calls of the messages' successful parse runs, one row per call.
	 * Only the ids leave: the inputs of the calls stay in the table.
	 */
	async findForgetCallMessageIds({
		userId,
		messageIds,
	}: {
		userId: string
		messageIds: string[]
	}): Promise<ForgetCallRow[]> {
		const calls = await this.prisma.aiToolCall.findMany({
			where: {
				name: AI_TOOL_NAMES.forgetFact,
				status: ToolCallStatus.SUCCEEDED,
				aiRun: {
					userId,
					messageId: { in: messageIds },
					purpose: AiRunPurpose.PARSE_FOOD,
					status: AiRunStatus.SUCCEEDED,
				},
			},
			select: { aiRunId: true, aiRun: { select: { messageId: true, createdAt: true } } },
		})
		return calls.flatMap(({ aiRunId, aiRun }) =>
			aiRun.messageId === null
				? []
				: [{ messageId: aiRun.messageId, aiRunId, runCreatedAt: aiRun.createdAt }],
		)
	}

	/**
	 * Writes the food a forget_food / restore_food call of the message's latest parse run ended up
	 * with: the turn knows it only after the model answered. A call is found by its ref.
	 */
	async setFoodCallResults(
		{
			userId,
			messageId,
			results,
		}: {
			userId: string
			messageId: string
			results: { name: FoodCallName; ref: string; myFoodId: string }[]
		},
		tx: Prisma.TransactionClient,
	): Promise<void> {
		if (results.length === 0) return
		const run = await tx.aiRun.findFirst({
			where: { userId, messageId, purpose: AiRunPurpose.PARSE_FOOD, status: AiRunStatus.SUCCEEDED },
			orderBy: { createdAt: 'desc' },
			select: { id: true },
		})
		if (!run) return
		for (const { name, ref, myFoodId } of results) {
			await tx.aiToolCall.updateMany({
				where: { aiRunId: run.id, name, input: { path: ['ref'], equals: ref } },
				data: { result: { myFoodId } },
			})
		}
	}

	/**
	 * The foods the successful forget_food and restore_food calls of the messages' successful parse
	 * runs ended up with (see setFoodCallResults); a call that changed nothing has no result.
	 */
	async findFoodCalls({
		userId,
		messageIds,
	}: {
		userId: string
		messageIds: string[]
	}): Promise<FoodCallRow[]> {
		const names: FoodCallName[] = [AI_TOOL_NAMES.forgetFood, AI_TOOL_NAMES.restoreFood]
		const calls = await this.prisma.aiToolCall.findMany({
			where: {
				name: { in: names },
				status: ToolCallStatus.SUCCEEDED,
				aiRun: {
					userId,
					messageId: { in: messageIds },
					purpose: AiRunPurpose.PARSE_FOOD,
					status: AiRunStatus.SUCCEEDED,
				},
			},
			select: {
				aiRunId: true,
				name: true,
				result: true,
				createdAt: true,
				aiRun: { select: { messageId: true, createdAt: true } },
			},
			orderBy: { createdAt: 'asc' },
		})
		return calls.flatMap(({ aiRunId, name, result, aiRun }) => {
			const myFoodId = getStoredFoodId(result)
			const isFoodCall = name === AI_TOOL_NAMES.forgetFood || name === AI_TOOL_NAMES.restoreFood
			if (aiRun.messageId === null || myFoodId === null || !isFoodCall) return []
			return [
				{ messageId: aiRun.messageId, aiRunId, runCreatedAt: aiRun.createdAt, name, myFoodId },
			]
		})
	}

	/**
	 * The successful read calls (find_food, get_workouts) of the messages' successful parse runs,
	 * oldest first. Only the stored result leaves, and only for the user's own messages.
	 */
	async findReadCalls({
		userId,
		messageIds,
	}: {
		userId: string
		messageIds: string[]
	}): Promise<ReadCallRow[]> {
		const calls = await this.prisma.aiToolCall.findMany({
			where: {
				name: { in: [...READ_TOOL_NAMES] },
				status: ToolCallStatus.SUCCEEDED,
				aiRun: {
					userId,
					messageId: { in: messageIds },
					purpose: AiRunPurpose.PARSE_FOOD,
					status: AiRunStatus.SUCCEEDED,
				},
			},
			select: { result: true, createdAt: true, aiRun: { select: { messageId: true } } },
			orderBy: { createdAt: 'asc' },
		})
		return calls.flatMap(({ result, createdAt, aiRun }) =>
			aiRun.messageId === null || result === null
				? []
				: [{ messageId: aiRun.messageId, result, createdAt }],
		)
	}

	async deleteToolCallsBefore(cutoff: Date): Promise<number> {
		const { count } = await this.prisma.aiToolCall.deleteMany({
			where: { createdAt: { lt: cutoff } },
		})
		return count
	}
}
