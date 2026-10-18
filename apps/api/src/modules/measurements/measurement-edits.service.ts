import { Injectable, Logger } from '@nestjs/common'
import { MEASUREMENT_LIMITS, type MeasurementCard } from '@kus/shared'

import { ChatMeasurementCardsService } from '../chat/chat-measurement-cards.service'
import {
	MeasurementNotFoundException,
	MeasurementValueOutOfRangeException,
} from './measurements.exceptions'
import type { MeasurementValue } from './measurements.mapper'
import { MeasurementsService } from './measurements.service'

const TENTHS = 10

/**
 * Manual edits from the chat card: change the value, delete (soft) and bring it back. The answers
 * are the same cards the chat shows, so the client replaces the card as it is.
 */
@Injectable()
export class MeasurementEditsService {
	private readonly logger = new Logger(MeasurementEditsService.name)

	constructor(
		private readonly measurementsService: MeasurementsService,
		private readonly cards: ChatMeasurementCardsService,
	) {}

	async update(userId: string, id: string, rawValue: number): Promise<MeasurementCard> {
		const row = await this.findOwned(userId, id)
		if (row.deletedAt !== null) throw new MeasurementNotFoundException()
		const value = Math.round(rawValue * TENTHS) / TENTHS
		const { min, max } = MEASUREMENT_LIMITS[row.kind]
		if (value < min) throw new MeasurementValueOutOfRangeException('TOO_SMALL')
		if (value > max) throw new MeasurementValueOutOfRangeException('TOO_LARGE')

		if (!(await this.measurementsService.updateValue(id, userId, value))) {
			throw new MeasurementNotFoundException()
		}
		this.logger.log(`Measurement edited user=${userId} measurement=${id}`)
		return this.cards.getCard(userId, await this.findOwned(userId, id))
	}

	async remove(userId: string, id: string): Promise<void> {
		if (!(await this.measurementsService.softDelete(id, userId))) {
			throw new MeasurementNotFoundException()
		}
		this.logger.log(`Measurement deleted user=${userId} measurement=${id}`)
	}

	/** Idempotent: a value that was not deleted comes back as it is. */
	async restore(userId: string, id: string): Promise<MeasurementCard> {
		const row = await this.findOwned(userId, id)
		if (row.deletedAt !== null) {
			await this.measurementsService.restore(id, userId)
			this.logger.log(`Measurement restored user=${userId} measurement=${id}`)
		}
		return this.cards.getCard(userId, await this.findOwned(userId, id))
	}

	private async findOwned(userId: string, id: string): Promise<MeasurementValue> {
		const row = await this.measurementsService.findByIdForUser(id, userId)
		if (!row) throw new MeasurementNotFoundException()
		return row
	}
}
