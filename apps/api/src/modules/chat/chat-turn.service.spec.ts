import { Logger } from '@nestjs/common'
import { STATS_EMPTY_REPLY } from '@kus/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TurnCopySourceMissingException, TurnDateOutOfRangeException } from './chat.exceptions'
import { ChatTurnService } from './chat-turn.service'

beforeEach(() => {
	vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
})

const TIMEZONE = 'Europe/Warsaw'
// 14:20 on Sunday 2026-10-18 in Warsaw (UTC+2): lunch by the clock
const NOW = new Date('2026-10-18T12:20:00Z')
const TODAY = new Date('2026-10-18T00:00:00Z')

const toItem = (name: string, overrides: Record<string, unknown> = {}) => ({
	name,
	grams: 100,
	quantity: null,
	kcal: 100,
	protein: 1,
	fat: 1,
	carbs: 1,
	fiber: null,
	category: 'other',
	source: 'ESTIMATE',
	confidence: 0.8,
	assumption: null,
	memoryRef: null,
	copyRef: null,
	mealType: null,
	date: null,
	...overrides,
})

const toLogDecision = (items: ReturnType<typeof toItem>[], log: Record<string, unknown> = {}) =>
	({
		kind: 'log',
		log: { items, mealType: null, date: null, reply: 'ok', ...log },
		clarifications: [],
		edits: { corrections: [], deletions: [], restorations: [], resolutions: [] },
		measurements: [],
		measurementDeletions: [],
		workouts: [],
	}) as never

const createService = () => {
	const logEntries = vi.fn().mockResolvedValue({ meals: [], entryIds: [] })
	const remove = vi.fn().mockResolvedValue([])
	const record = vi.fn().mockResolvedValue([])
	const build = vi.fn().mockResolvedValue(null)
	const close = vi.fn().mockResolvedValue({ dayCard: null, isLogged: false })
	const buildStats = vi.fn().mockResolvedValue(null)
	const completeTurn = vi.fn().mockResolvedValue({ id: 'reply-1' })
	const setDayCard = vi.fn().mockResolvedValue(undefined)
	const findActiveEntriesByIds = vi.fn().mockResolvedValue([])
	const recordForTurn = vi.fn()
	const logWorkouts = vi.fn().mockResolvedValue({ sourceMessageIds: [] })
	const service = new ChatTurnService(
		{ $transaction: (callback: (tx: unknown) => unknown) => callback({}) } as never,
		{ completeTurn, setDayCard } as never,
		{ createClarification: vi.fn() } as never,
		{ applyEdits: vi.fn().mockResolvedValue({ sourceMessageIds: [], replyIds: [] }) } as never,
		{ logEntries, findActiveEntriesByIds } as never,
		{ markUsed: vi.fn() } as never,
		{ remove, record } as never,
		{ recordForTurn } as never,
		{ build } as never,
		{ close } as never,
		{ build: buildStats } as never,
		{ logWorkouts } as never,
	)
	const save = (decision: never, copyRefIds: Map<string, string> = new Map()) =>
		service.saveDecision(
			{
				userId: 'u1',
				timezone: TIMEZONE,
				message: { id: 'm1' } as never,
				now: NOW,
				localDate: TODAY,
			},
			decision,
			{ memory: { byRef: new Map(), context: [] }, refIds: {}, copyRefIds } as never,
		)
	return {
		save,
		logEntries,
		remove,
		record,
		build,
		completeTurn,
		close,
		buildStats,
		setDayCard,
		findActiveEntriesByIds,
		recordForTurn,
	}
}

const getLogged = (logEntries: ReturnType<typeof vi.fn>) => {
	const params: unknown = logEntries.mock.calls[0]?.[0]
	return params as {
		entries: { mealType: string; localDate: Date; entry: Record<string, unknown> }[]
		getEatenAt: (meal: { type: string; localDate: Date }) => Date
	}
}

describe('ChatTurnService.saveDecision food days', () => {
	it('puts an item without a date on today and picks its meal by the clock', async () => {
		const { save, logEntries } = createService()

		await save(toLogDecision([toItem('борщ')]))

		const { entries, getEatenAt } = getLogged(logEntries)
		expect(entries.map(({ mealType, localDate }) => [mealType, localDate])).toEqual([
			['LUNCH', TODAY],
		])
		expect(getEatenAt({ type: 'LUNCH', localDate: TODAY })).toBe(NOW)
	})

	it('gives every item its own day: item date, else the call date, else today', async () => {
		const { save, logEntries } = createService()

		await save(
			toLogDecision(
				[toItem('a', { date: '2026-10-16' }), toItem('b'), toItem('c', { date: '2026-10-19' })],
				{ date: '2026-10-17' },
			),
		)

		const { entries } = getLogged(logEntries)
		expect(entries.map(({ localDate }) => localDate.toISOString().slice(0, 10))).toEqual([
			'2026-10-16',
			'2026-10-17',
			'2026-10-19',
		])
	})

	it('does not leave the date in the entry columns', async () => {
		const { save, logEntries } = createService()

		await save(toLogDecision([toItem('a', { date: '2026-10-17' })]))

		expect(getLogged(logEntries).entries[0]?.entry).not.toHaveProperty('date')
	})

	it('picks the meal of another day by the current clock and eats it at the typical hour', async () => {
		const { save, logEntries } = createService()
		const yesterday = new Date('2026-10-17T00:00:00Z')

		await save(toLogDecision([toItem('піца', { date: '2026-10-17' })]))

		const { entries, getEatenAt } = getLogged(logEntries)
		// lunch by the clock of the turn; 13:00 yesterday in Warsaw, not cut to "now"
		expect(entries[0]?.mealType).toBe('LUNCH')
		expect(getEatenAt({ type: 'LUNCH', localDate: yesterday }).toISOString()).toBe(
			'2026-10-17T11:00:00.000Z',
		)
	})

	it('puts a named meal of yesterday at its typical hour', async () => {
		const { save, logEntries } = createService()

		await save(toLogDecision([toItem('омлет', { date: '2026-10-17', mealType: 'BREAKFAST' })]))

		const { entries, getEatenAt } = getLogged(logEntries)
		expect(entries[0]?.mealType).toBe('BREAKFAST')
		expect(
			getEatenAt({ type: 'BREAKFAST', localDate: new Date('2026-10-17T00:00:00Z') }).toISOString(),
		).toBe('2026-10-17T06:00:00.000Z')
	})

	it('plans tomorrow at the typical hour of the meal, in the future', async () => {
		const { save, logEntries } = createService()
		const tomorrow = new Date('2026-10-19T00:00:00Z')

		await save(toLogDecision([toItem('вечеря', { date: '2026-10-19', mealType: 'DINNER' })]))

		const eatenAt = getLogged(logEntries).getEatenAt({ type: 'DINNER', localDate: tomorrow })
		expect(eatenAt.toISOString()).toBe('2026-10-19T17:00:00.000Z')
		expect(eatenAt.getTime()).toBeGreaterThan(NOW.getTime())
	})

	it('uses the message meal for items without their own', async () => {
		const { save, logEntries } = createService()

		await save(
			toLogDecision([toItem('a', { date: '2026-10-16' }), toItem('b', { mealType: 'SNACK' })], {
				mealType: 'DINNER',
			}),
		)

		expect(getLogged(logEntries).entries.map(({ mealType }) => mealType)).toEqual([
			'DINNER',
			'SNACK',
		])
	})

	it.each(['2026-10-14', '2026-10-20'])(
		'stops the turn for %s, outside the loggable days',
		async (date) => {
			const { save, logEntries } = createService()

			await expect(save(toLogDecision([toItem('a', { date })]))).rejects.toBeInstanceOf(
				TurnDateOutOfRangeException,
			)
			expect(logEntries).not.toHaveBeenCalled()
		},
	)

	it('accepts the edges of the window: today − 3 and today + 1', async () => {
		const { save, logEntries } = createService()

		await save(
			toLogDecision([toItem('a', { date: '2026-10-15' }), toItem('b', { date: '2026-10-19' })]),
		)

		expect(logEntries).toHaveBeenCalledTimes(1)
	})
})

describe('ChatTurnService.saveDecision measurement deletions', () => {
	it('deletes the named values before recording new ones and returns the changed cards', async () => {
		const { save, remove, record } = createService()
		remove.mockResolvedValue(['old-message'])
		record.mockResolvedValue(['replaced-message'])
		const decision = {
			kind: 'reply',
			text: 'ok',
			measurements: [{ kind: 'WAIST', value: 90, date: null, confirmedJump: false }],
			measurementDeletions: [{ kind: 'WEIGHT', date: '2026-10-16' }],
		} as never

		const result = await save(decision)

		expect(remove).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'u1',
				deletions: [{ kind: 'WEIGHT', date: '2026-10-16' }],
			}),
			expect.anything(),
		)
		expect(result.replacedMeasurementMessageIds).toEqual(['old-message', 'replaced-message'])
	})
})

describe('ChatTurnService.saveDecision show_day', () => {
	const toDayDecision = (date: string | null) => ({ kind: 'day', date, text: 'Ось день' }) as never
	const CARD = { version: 1, localDate: '2026-10-17' }

	it('stores the snapshot with the reply, counted for the named day', async () => {
		const { save, build, completeTurn } = createService()
		build.mockResolvedValue(CARD)

		await save(toDayDecision('2026-10-17'))

		expect(build).toHaveBeenCalledWith({
			userId: 'u1',
			localDate: '2026-10-17',
			today: '2026-10-18',
			now: NOW,
		})
		expect(completeTurn).toHaveBeenCalledWith(
			expect.objectContaining({ replyText: 'Ось день', dayCard: CARD }),
			expect.anything(),
		)
	})

	it('shows today when the model names no date', async () => {
		const { save, build } = createService()

		await save(toDayDecision(null))

		expect(build).toHaveBeenCalledWith(expect.objectContaining({ localDate: '2026-10-18' }))
	})

	it('keeps only the text for an empty day', async () => {
		const { save, completeTurn } = createService()

		await save(toDayDecision('2026-10-16'))

		const params: unknown = completeTurn.mock.calls[0]?.[0]
		expect(params).toMatchObject({ replyText: 'Ось день' })
		expect((params as { dayCard?: unknown }).dayCard).toBeUndefined()
	})

	it.each([
		['2026-10-13', -5],
		['2020-01-01', -2108],
	])('builds the snapshot for %s, older than the logging window', async (date) => {
		const { save, build, completeTurn } = createService()
		const card = { version: 1, localDate: date, kind: 'past' }
		build.mockResolvedValue(card)

		await save(toDayDecision(date))

		expect(build).toHaveBeenCalledWith(expect.objectContaining({ localDate: date }))
		expect(completeTurn).toHaveBeenCalledWith(
			expect.objectContaining({ dayCard: card }),
			expect.anything(),
		)
	})

	it('stops the turn for a day after tomorrow', async () => {
		const { save, build, completeTurn } = createService()

		await expect(save(toDayDecision('2026-10-20'))).rejects.toBeInstanceOf(
			TurnDateOutOfRangeException,
		)
		expect(build).not.toHaveBeenCalled()
		expect(completeTurn).not.toHaveBeenCalled()
	})

	it('still refuses to log food on the same old day', async () => {
		const { save, logEntries } = createService()

		await expect(save(toLogDecision([toItem('a', { date: '2026-10-13' })]))).rejects.toBeInstanceOf(
			TurnDateOutOfRangeException,
		)
		expect(logEntries).not.toHaveBeenCalled()
	})

	it('stores no snapshot for other kinds of answers', async () => {
		const { save, build } = createService()

		await save({ kind: 'not_food', reply: 'ні' } as never)

		expect(build).not.toHaveBeenCalled()
	})
})

describe('ChatTurnService.saveDecision close_day', () => {
	const toCloseDecision = (date: string | null, estimatedTotalKcal: number | null) =>
		({ kind: 'close_day', date, estimatedTotalKcal, text: 'Готово' }) as never
	const CARD = { version: 1, localDate: '2026-10-18', isClosing: true }

	it('closes the day inside the turn and writes its card onto the reply', async () => {
		const { save, close, setDayCard, logEntries } = createService()
		close.mockResolvedValue({ dayCard: CARD, isLogged: false })

		const result = await save(toCloseDecision('2026-10-17', 1800))

		expect(close).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'u1',
				messageId: 'm1',
				date: '2026-10-17',
				estimatedTotalKcal: 1800,
				localDate: TODAY,
			}),
			expect.anything(),
		)
		expect(setDayCard).toHaveBeenCalledWith(
			{ userId: 'u1', id: 'reply-1', dayCard: CARD },
			expect.anything(),
		)
		expect(logEntries).not.toHaveBeenCalled()
		expect(result.sourceMessageIds).toEqual([])
	})

	it('keeps only the text for an empty day', async () => {
		const { save, setDayCard } = createService()

		await save(toCloseDecision(null, null))

		expect(setDayCard).not.toHaveBeenCalled()
	})

	it('counts a logged gap as a food change and refreshes the cards of its meal', async () => {
		const { save, close, recordForTurn } = createService()
		close.mockResolvedValue({ dayCard: CARD, isLogged: true })

		const result = await save(toCloseDecision(null, 1800))

		expect(recordForTurn).toHaveBeenCalledWith(
			expect.objectContaining({ isFoodChanged: true, isWeightLogged: false }),
			expect.anything(),
		)
		expect(result.sourceMessageIds).toEqual(['m1'])
	})
})

describe('ChatTurnService.saveDecision show_stats', () => {
	const toStatsDecision = (endDate: string | null) =>
		({ kind: 'stats', days: 7, endDate, text: 'Ось тиждень' }) as never

	it('stores the card counted for the user today with the reply', async () => {
		const { save, buildStats, completeTurn } = createService()
		const card = { version: 1, period: 'week' }
		buildStats.mockResolvedValue(card)

		await save(toStatsDecision('2026-10-10'))

		expect(buildStats).toHaveBeenCalledWith({
			userId: 'u1',
			days: 7,
			endDate: '2026-10-10',
			today: '2026-10-18',
		})
		expect(completeTurn).toHaveBeenCalledWith(
			expect.objectContaining({ replyText: 'Ось тиждень', statsCard: card }),
			expect.anything(),
		)
	})

	it('stores no card and the fixed text instead of the model one when nothing was logged', async () => {
		const { save, completeTurn } = createService()

		await save(toStatsDecision(null))

		const params: unknown = completeTurn.mock.calls[0]?.[0]
		expect((params as { statsCard?: unknown }).statsCard).toBeUndefined()
		expect(params).toMatchObject({ replyText: STATS_EMPTY_REPLY })
	})
})

describe('ChatTurnService.saveDecision copyRef', () => {
	const EARLIER = {
		id: 'entry-y1',
		name: 'Гречка варена',
		grams: 200,
		kcal: 240,
		proteinG: 8,
		fatG: 2,
		carbsG: 46,
		fiberG: 6,
		category: 'grains',
		source: 'LABEL',
		confidence: 0.9,
		myFoodId: 'food-1',
		isUndetailed: true,
		meal: { type: 'DINNER', localDate: new Date('2026-10-17T00:00:00Z') },
	}

	it('remembers the day of the entry it was copied from, and does not inherit the estimate flag', async () => {
		const { save, logEntries, findActiveEntriesByIds } = createService()
		findActiveEntriesByIds.mockResolvedValue([EARLIER])

		await save(
			toLogDecision([toItem('Гречка', { copyRef: 'y1', grams: 100 }), toItem('Яблуко')]),
			new Map([['y1', 'entry-y1']]),
		)

		const [copy, plain] = getLogged(logEntries).entries.map(({ entry }) => entry)
		expect(copy).toMatchObject({ copiedFromDate: new Date('2026-10-17T00:00:00Z') })
		expect(copy).not.toHaveProperty('isUndetailed')
		expect(plain).not.toHaveProperty('copiedFromDate')
	})

	it('copies the earlier values scaled by the new grams, with category, source and food link', async () => {
		const { save, logEntries, findActiveEntriesByIds } = createService()
		findActiveEntriesByIds.mockResolvedValue([EARLIER])

		await save(
			toLogDecision([
				toItem('Гречка', { copyRef: 'y1', grams: 100, kcal: 999, source: 'ESTIMATE' }),
			]),
			new Map([['y1', 'entry-y1']]),
		)

		expect(findActiveEntriesByIds).toHaveBeenCalledWith('u1', ['entry-y1'], expect.anything())
		const entry = getLogged(logEntries).entries[0]?.entry
		expect(entry).toMatchObject({
			grams: 100,
			kcal: 120,
			protein: 4,
			fat: 1,
			carbs: 23,
			fiber: 3,
			category: 'grains',
			source: 'LABEL',
			confidence: 0.9,
			myFoodId: 'food-1',
		})
		expect(entry).not.toHaveProperty('copyRef')
	})

	it('reads only the refs of this request and only the ids the context mapped', async () => {
		const { save, findActiveEntriesByIds } = createService()

		findActiveEntriesByIds.mockResolvedValue([EARLIER])
		await expect(
			save(
				toLogDecision([toItem('a', { copyRef: 'y1' }), toItem('b', { copyRef: 'y9' })]),
				new Map([['y1', 'entry-y1']]),
			),
		).rejects.toBeInstanceOf(TurnCopySourceMissingException)

		expect(findActiveEntriesByIds).toHaveBeenCalledWith('u1', ['entry-y1'], expect.anything())
	})

	it('stops the turn instead of storing the model numbers when the entry is gone', async () => {
		const { save, logEntries } = createService()

		await expect(
			save(
				toLogDecision([toItem('a', { copyRef: 'y1', kcal: 100 })]),
				new Map([['y1', 'deleted-entry']]),
			),
		).rejects.toMatchObject({
			status: 409,
			errorCode: 'TURN_COPY_SOURCE_MISSING',
		})

		expect(logEntries).not.toHaveBeenCalled()
	})

	it('stops the turn when only one of two copy sources is still there', async () => {
		const { save, logEntries, findActiveEntriesByIds } = createService()
		findActiveEntriesByIds.mockResolvedValue([EARLIER])

		await expect(
			save(
				toLogDecision([toItem('a', { copyRef: 'y1' }), toItem('b', { copyRef: 'y2' })]),
				new Map([
					['y1', 'entry-y1'],
					['y2', 'deleted-entry'],
				]),
			),
		).rejects.toBeInstanceOf(TurnCopySourceMissingException)

		expect(logEntries).not.toHaveBeenCalled()
	})
})
