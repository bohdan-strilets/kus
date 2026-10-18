import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MeasurementNotFoundException } from '../measurements/measurements.exceptions'
import { TurnDateOutOfRangeException } from './chat.exceptions'
import { ChatTurnMeasurementsService } from './chat-turn-measurements.service'

beforeEach(() => {
	vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
})

const TIMEZONE = 'Europe/Warsaw'
const NOW = new Date('2026-10-18T12:20:00Z')
const TODAY = new Date('2026-10-18T00:00:00Z')
const TX = {} as never

const toRow = (id: string, messageId: string | null) => ({ id, messageId })

const createService = (existing: ReturnType<typeof toRow> | null = null) => {
	const findByDate = vi.fn().mockResolvedValue(existing)
	const record = vi.fn().mockResolvedValue(undefined)
	const softDelete = vi.fn().mockResolvedValue(true)
	const service = new ChatTurnMeasurementsService({ findByDate, record, softDelete } as never)
	const base = { userId: 'u1', message: { id: 'm9' } as never, localDate: TODAY }
	return { service, findByDate, record, softDelete, base }
}

const weight = (date: string | null, value = 82) => ({
	kind: 'WEIGHT' as const,
	value,
	date,
	confirmedJump: false,
})

describe('ChatTurnMeasurementsService.record', () => {
	it('records today at the moment of the message and an older day at noon', async () => {
		const { service, record, base } = createService()

		await service.record(
			{ ...base, timezone: TIMEZONE, now: NOW, measurements: [weight(null), weight('2026-10-16')] },
			TX,
		)

		expect(
			(record.mock.calls as [{ measuredAt: Date }][]).map(([data]) =>
				data.measuredAt.toISOString(),
			),
		).toEqual([NOW.toISOString(), '2026-10-16T10:00:00.000Z'])
		expect(record.mock.calls[0]?.[0]).toMatchObject({ source: 'CHAT', messageId: 'm9' })
	})

	it('returns the message whose value a new one replaces', async () => {
		const { service, base } = createService(toRow('r1', 'old-message'))

		const replaced = await service.record(
			{ ...base, timezone: TIMEZONE, now: NOW, measurements: [weight('2026-10-17')] },
			TX,
		)

		expect(replaced).toEqual(['old-message'])
	})

	it('rejects a future day', async () => {
		const { service, record, base } = createService()

		await expect(
			service.record(
				{ ...base, timezone: TIMEZONE, now: NOW, measurements: [weight('2026-10-19')] },
				TX,
			),
		).rejects.toBeInstanceOf(TurnDateOutOfRangeException)
		expect(record).not.toHaveBeenCalled()
	})

	it('rejects a new value older than 3 days but lets an existing one be fixed up to 7 days back', async () => {
		const missing = createService(null)
		await expect(
			missing.service.record(
				{ ...missing.base, timezone: TIMEZONE, now: NOW, measurements: [weight('2026-10-12')] },
				TX,
			),
		).rejects.toBeInstanceOf(TurnDateOutOfRangeException)

		const existing = createService(toRow('r1', 'old'))
		await existing.service.record(
			{ ...existing.base, timezone: TIMEZONE, now: NOW, measurements: [weight('2026-10-11')] },
			TX,
		)
		expect(existing.record).toHaveBeenCalledTimes(1)

		await expect(
			existing.service.record(
				{ ...existing.base, timezone: TIMEZONE, now: NOW, measurements: [weight('2026-10-10')] },
				TX,
			),
		).rejects.toBeInstanceOf(TurnDateOutOfRangeException)
	})
})

describe('ChatTurnMeasurementsService.remove', () => {
	it('soft-deletes the value of the user and returns the message of its card', async () => {
		const { service, findByDate, softDelete, base } = createService(toRow('r1', 'old-message'))

		const changed = await service.remove(
			{ ...base, deletions: [{ kind: 'WEIGHT', date: '2026-10-16' }] },
			TX,
		)

		expect(findByDate).toHaveBeenCalledWith(
			{ userId: 'u1', kind: 'WEIGHT', localDate: new Date('2026-10-16T00:00:00Z') },
			TX,
		)
		expect(softDelete).toHaveBeenCalledWith('r1', 'u1', TX)
		expect(changed).toEqual(['old-message'])
	})

	it('has no card to update for a value without a message', async () => {
		const { service, base } = createService(toRow('r1', null))

		expect(
			await service.remove({ ...base, deletions: [{ kind: 'WEIGHT', date: '2026-10-16' }] }, TX),
		).toEqual([])
	})

	it('fails when there is no live value of the user on that day', async () => {
		const { service, softDelete, base } = createService(null)

		await expect(
			service.remove({ ...base, deletions: [{ kind: 'WAIST', date: '2026-10-16' }] }, TX),
		).rejects.toBeInstanceOf(MeasurementNotFoundException)
		expect(softDelete).not.toHaveBeenCalled()
	})

	it('rejects a day beyond a week back or in the future', async () => {
		const { service, findByDate, base } = createService(toRow('r1', 'm'))

		for (const date of ['2026-10-10', '2026-10-19']) {
			await expect(
				service.remove({ ...base, deletions: [{ kind: 'WEIGHT', date }] }, TX),
			).rejects.toBeInstanceOf(TurnDateOutOfRangeException)
		}
		expect(findByDate).not.toHaveBeenCalled()
	})
})
