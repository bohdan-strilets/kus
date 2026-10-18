import { Injectable, Logger } from '@nestjs/common'
import {
	type DeleteMeasurementInput,
	getDayOffset,
	type LogMeasurementInput,
	MEASUREMENT_BACKDATE_MAX_DAYS,
	MEASUREMENT_FIX_MAX_DAYS,
} from '@kus/shared'

import { formatDbDate, getZonedMoment } from '../../common/time'
import { MeasurementSource, type Prisma } from '../../generated/prisma/client'
import { MeasurementNotFoundException } from '../measurements/measurements.exceptions'
import { MeasurementsService } from '../measurements/measurements.service'
import { TurnDateOutOfRangeException } from './chat.exceptions'
import type { TurnParams } from './chat-turn.service'

const MEASUREMENT_BACKDATE_HOUR = 12

type MeasurementTurnParams = Pick<
	TurnParams,
	'userId' | 'timezone' | 'message' | 'now' | 'localDate'
>

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

/** Weight and waist of a chat turn: recorded, replaced and deleted inside the turn's transaction. */
@Injectable()
export class ChatTurnMeasurementsService {
	private readonly logger = new Logger(ChatTurnMeasurementsService.name)

	constructor(private readonly measurementsService: MeasurementsService) {}

	/**
	 * Weight and waist of the message, one per day and kind: a second value of a day replaces the
	 * first. Returns the messages that carried the replaced values.
	 */
	async record(
		{
			userId,
			timezone,
			message,
			now,
			localDate,
			measurements,
		}: MeasurementTurnParams & { measurements: LogMeasurementInput[] },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		const today = formatDbDate(localDate)
		const replacedMessageIds: string[] = []
		for (const { kind, value, date } of measurements) {
			const day = date === null ? localDate : toDbDate(date)
			const previous = await this.measurementsService.findByDate(
				{ userId, kind, localDate: day },
				tx,
			)
			// the parser lets a value older than the backdate window in only to fix an existing one
			const offset = getDayOffset(formatDbDate(day), today)
			const isTooOld =
				offset < -MEASUREMENT_FIX_MAX_DAYS ||
				(offset < -MEASUREMENT_BACKDATE_MAX_DAYS && previous === null)
			if (offset > 0 || isTooOld) this.rejectDate(userId, message.id)
			await this.measurementsService.record(
				{
					userId,
					kind,
					value,
					localDate: day,
					// a past day has no real time of day: noon keeps it on that date in any timezone
					measuredAt: offset === 0 ? now : getZonedMoment(day, MEASUREMENT_BACKDATE_HOUR, timezone),
					source: MeasurementSource.CHAT,
					messageId: message.id,
				},
				tx,
			)
			if (previous?.messageId && previous.messageId !== message.id) {
				replacedMessageIds.push(previous.messageId)
			}
		}
		return replacedMessageIds
	}

	/**
	 * Deletes the values the model named (the parser accepted only days listed in the context).
	 * Returns the messages whose card became a «deleted» row.
	 */
	async remove(
		{
			userId,
			message,
			localDate,
			deletions,
		}: Pick<MeasurementTurnParams, 'userId' | 'message' | 'localDate'> & {
			deletions: DeleteMeasurementInput[]
		},
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		const today = formatDbDate(localDate)
		const changedMessageIds: string[] = []
		for (const { kind, date } of deletions) {
			const offset = getDayOffset(date, today)
			if (offset > 0 || offset < -MEASUREMENT_FIX_MAX_DAYS) this.rejectDate(userId, message.id)
			const row = await this.measurementsService.findByDate(
				{ userId, kind, localDate: toDbDate(date) },
				tx,
			)
			if (!row || !(await this.measurementsService.softDelete(row.id, userId, tx))) {
				throw new MeasurementNotFoundException()
			}
			if (row.messageId && row.messageId !== message.id) changedMessageIds.push(row.messageId)
		}
		return changedMessageIds
	}

	private rejectDate(userId: string, messageId: string): never {
		this.logger.error(`Measurement date out of range user=${userId} message=${messageId}`)
		throw new TurnDateOutOfRangeException()
	}
}
