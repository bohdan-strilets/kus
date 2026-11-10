import { Logger } from '@nestjs/common'
import { afterAll, describe, expect, it, vi } from 'vitest'

import type { MyFood } from '../../generated/prisma/client'
import { AiUnavailableException } from '../ai/ai.exceptions'
import type { RecentEntryName } from '../entries/entries.service'
import { ChatReadToolsService, type ReadToolTurnRefs } from './chat-read-tools.service'

const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

const OWNER = 'u-owner'
const STRANGER = 'u-stranger'

const food = (id: string, name: string): MyFood =>
	({
		id,
		name,
		aliases: [],
		kcalPer100g: 376,
		proteinPer100g: 50,
		fatPer100g: 8,
		carbsPer100g: 22,
		fiberPer100g: null,
		pieceGrams: 45,
		defaultGrams: null,
		category: 'protein_bar',
		usageCount: 7,
		lastUsedAt: new Date('2026-11-07T09:00:00Z'),
	}) as unknown as MyFood

const recent = (id: string, name: string, count = 1): RecentEntryName => ({
	count,
	entry: {
		id,
		name,
		grams: 45,
		kcal: 170,
		source: 'LABEL',
		meal: { type: 'DINNER', localDate: new Date('2026-11-07T00:00:00Z') },
	} as unknown as RecentEntryName['entry'],
})

/** Data by user, as the real services filter it (active foods and entries of that user only). */
const FOODS: Record<string, MyFood[]> = {
	[OWNER]: [food('f-own', 'Батончик SportyFeel')],
	[STRANGER]: [food('f-other', 'Батончик Секретний')],
}
const ENTRIES: Record<string, RecentEntryName[]> = {
	[OWNER]: [recent('e-own', 'Протеїновий батончик Sportyfeel', 3)],
	[STRANGER]: [recent('e-other', 'Секретний батончик')],
}

const create = () => {
	const searchFoods = vi.fn((userId: string) => Promise.resolve(FOODS[userId] ?? []))
	const findRecentEntryNames = vi.fn((userId: string) => Promise.resolve(ENTRIES[userId] ?? []))
	const service = new ChatReadToolsService(
		{ searchFoods } as never,
		{ findRecentEntryNames } as never,
	)
	const turn: ReadToolTurnRefs = {
		memory: { byRef: new Map([['m1', food('f-ctx', 'Ковбаса')]]) },
		copyRefIds: new Map([
			['y1', 'e-y'],
			['h2', 'e-h'],
		]),
	}
	const executor = service.createExecutor(turn)
	const find = (arguments_: unknown, userId = OWNER) =>
		executor.execute(
			{ name: 'find_food', arguments: JSON.stringify(arguments_) },
			{
				userId,
				localDate: new Date('2026-11-09T00:00:00Z'),
				signal: AbortSignal.timeout(1000),
			},
		)
	return { turn, find, searchFoods, findRecentEntryNames }
}

describe('ChatReadToolsService find_food', () => {
	afterAll(() => {
		logSpy.mockRestore()
	})

	it('finds a saved food and an earlier entry and extends the maps of the turn after its refs', async () => {
		const { turn, find } = create()

		const result = await find({ query: 'спортіфіл', scope: 'all' })

		expect(result.text).toContain('m2 "Батончик SportyFeel"')
		expect(result.text).toContain('h3 2026-11-07 DINNER "Протеїновий батончик Sportyfeel"')
		expect(result.refsPatch).toEqual({ memoryRefs: ['m2'], copyRefs: ['h3'] })
		expect(turn.memory.byRef.get('m2')?.id).toBe('f-own')
		expect(turn.copyRefIds.get('h3')).toBe('e-own')
	})

	it('keeps a ref when the same food is asked twice, and reads each source once per turn', async () => {
		const { turn, find, searchFoods, findRecentEntryNames } = create()

		await find({ query: 'sportyfeel', scope: 'all' })
		const second = await find({ query: 'батончик sportyfeel', scope: 'all' })

		expect(second.refsPatch).toEqual({ memoryRefs: ['m2'], copyRefs: ['h3'] })
		expect(turn.memory.byRef.size).toBe(2)
		expect(turn.copyRefIds.size).toBe(3)
		expect(searchFoods).toHaveBeenCalledTimes(1)
		expect(findRecentEntryNames).toHaveBeenCalledTimes(1)
	})

	it('reads the user and the day from the turn, never from the arguments', async () => {
		const { find, searchFoods, findRecentEntryNames } = create()

		const result = await find({ query: 'секретний', scope: 'all', userId: STRANGER })

		expect(searchFoods).toHaveBeenCalledWith(OWNER)
		expect(findRecentEntryNames).toHaveBeenCalledWith(OWNER, {
			from: new Date('2026-08-11T00:00:00Z'),
			to: new Date('2026-11-08T00:00:00Z'),
		})
		expect(result.text).toBe('No match for "секретний"')
		expect(result.refsPatch).toEqual({ memoryRefs: [], copyRefs: [] })
	})

	it("does not show another user's food or entry", async () => {
		const stranger = create()

		const result = await stranger.find({ query: 'sportyfeel', scope: 'all' }, STRANGER)

		expect(result.text).toBe('No match for "sportyfeel"')
		expect(stranger.turn.memory.byRef.size).toBe(1)
	})

	it('searches only the asked source', async () => {
		const { find, searchFoods, findRecentEntryNames } = create()

		const result = await find({ query: 'sportyfeel', scope: 'history' })

		expect(searchFoods).not.toHaveBeenCalled()
		expect(findRecentEntryNames).toHaveBeenCalledTimes(1)
		expect(result.text).toMatch(/^h3 /)
	})

	it('answers invalid arguments as a tool result the model can fix', async () => {
		const { find, searchFoods } = create()

		for (const bad of [{ query: '' }, { query: 'x'.repeat(61) }, {}, { query: 'a', scope: 'zz' }]) {
			const { text } = await find(bad)
			expect(text).toMatch(/^error:/)
		}
		expect(searchFoods).not.toHaveBeenCalled()
	})

	it('logs only metadata, not the query or the names', async () => {
		const { find } = create()
		logSpy.mockClear()

		await find({ query: 'sportyfeel', scope: 'all' })

		const logged = logSpy.mock.calls.map(([line]) => String(line)).join('\n')
		expect(logged).toBe(`find_food user=${OWNER} scope=all found=2`)
	})

	it('fails the turn for a read tool it does not know', async () => {
		const service = new ChatReadToolsService({} as never, {} as never)
		const executor = service.createExecutor({ memory: { byRef: new Map() }, copyRefIds: new Map() })

		await expect(
			executor.execute(
				{ name: 'get_food_log', arguments: '{}' },
				{ userId: OWNER, localDate: new Date(), signal: AbortSignal.timeout(1000) },
			),
		).rejects.toBeInstanceOf(AiUnavailableException)
	})
})
