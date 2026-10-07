import { Injectable } from '@nestjs/common'

import {
	type AiRunPurpose,
	type AiRunStatus,
	Prisma,
	type ToolCallStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface CreateAiRunData {
	userId: string
	messageId: string | null
	purpose: AiRunPurpose
	model: string
	inputTokens: number
	outputTokens: number
	costUsd: number
	durationMs: number
	status: AiRunStatus
	errorCode: string | null
	toolCalls: { name: string; input: Prisma.InputJsonValue; status: ToolCallStatus }[]
}

interface DailyUsageKey {
	userId: string
	localDate: Date
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
	 * Counts one AI request against the daily limit. The conditional increment keeps parallel
	 * requests from slipping past the limit; `false` = the limit is used up.
	 */
	async reserveDailyMessage({
		userId,
		localDate,
		limit,
	}: DailyUsageKey & { limit: number }): Promise<boolean> {
		// full unique (userId, localDate), so upsert is safe here (docs/database.md)
		await this.prisma.dailyUsage.upsert({
			where: { userId_localDate: { userId, localDate } },
			create: { userId, localDate },
			update: {},
		})
		const { count } = await this.prisma.dailyUsage.updateMany({
			where: { userId, localDate, messageCount: { lt: limit } },
			data: { messageCount: { increment: 1 } },
		})
		return count === 1
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

	async deleteToolCallsBefore(cutoff: Date): Promise<number> {
		const { count } = await this.prisma.aiToolCall.deleteMany({
			where: { createdAt: { lt: cutoff } },
		})
		return count
	}
}
