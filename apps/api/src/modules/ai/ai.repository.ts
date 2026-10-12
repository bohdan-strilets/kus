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

	async deleteToolCallsBefore(cutoff: Date): Promise<number> {
		const { count } = await this.prisma.aiToolCall.deleteMany({
			where: { createdAt: { lt: cutoff } },
		})
		return count
	}
}
