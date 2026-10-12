import { Injectable } from '@nestjs/common'
import type { MeasurementCard } from '@kus/shared'

import { addDays } from '../../common/time'
import type { MeasurementKind } from '../../generated/prisma/client'
import type { MeasurementValue } from '../measurements/measurements.mapper'
import { MeasurementsService } from '../measurements/measurements.service'
import { ProfileService } from '../profile/profile.service'
import { buildMeasurementCard, MEASUREMENT_CHART_SPAN_DAYS } from './measurement-card'

const getEarliest = (rows: MeasurementValue[]): Date =>
	new Date(Math.min(...rows.map((row) => row.localDate.getTime())))

const getLatest = (rows: MeasurementValue[]): Date =>
	new Date(Math.max(...rows.map((row) => row.localDate.getTime())))

/** Weight and waist cards of the chat: the values a user message recorded, with their comparisons. */
@Injectable()
export class ChatMeasurementCardsService {
	constructor(
		private readonly measurementsService: MeasurementsService,
		private readonly profileService: ProfileService,
	) {}

	/**
	 * Per user message, the cards of the values it recorded. Queries per page, not per card: the
	 * profile once, and per kind the first value and one range around all the page's days.
	 */
	async getCardsByMessage(
		userId: string,
		messageIds: string[],
	): Promise<Map<string, MeasurementCard[]>> {
		const cards = new Map<string, MeasurementCard[]>()
		const rows = await this.measurementsService.findByMessageIds({ userId, messageIds })
		if (rows.length === 0) return cards

		const kinds = [...new Set(rows.map((row) => row.kind))]
		const [goal, ...perKind] = await Promise.all([
			this.profileService.findWeightGoal(userId),
			...kinds.map((kind) => this.loadKindContext(userId, kind, rows)),
		])
		const contextByKind = new Map(kinds.map((kind, index) => [kind, perKind[index]]))

		for (const row of rows) {
			const context = contextByKind.get(row.kind)
			if (row.messageId === null || !context) continue
			const card = buildMeasurementCard({ row, goal, ...context })
			cards.set(row.messageId, [...(cards.get(row.messageId) ?? []), card])
		}
		return cards
	}

	private async loadKindContext(
		userId: string,
		kind: MeasurementKind,
		rows: MeasurementValue[],
	): Promise<{ start: MeasurementValue | null; history: MeasurementValue[] }> {
		const ofKind = rows.filter((row) => row.kind === kind)
		const [start, history] = await Promise.all([
			this.measurementsService.findFirst({ userId, kind }),
			this.measurementsService.findInRange({
				userId,
				kind,
				from: addDays(getEarliest(ofKind), -MEASUREMENT_CHART_SPAN_DAYS),
				to: getLatest(ofKind),
			}),
		])
		return { start, history }
	}
}
