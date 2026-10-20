import { describe, expect, it } from 'vitest'

import { buildEarlierContext } from './history-context'

const toEntry = (
	id: string,
	name: string,
	{ date = '2026-10-18', grams = 150, kcal = 200, type = 'LUNCH' } = {},
) =>
	({
		id,
		name,
		grams,
		kcal,
		meal: { type, localDate: new Date(`${date}T00:00:00Z`) },
	}) as never

describe('buildEarlierContext', () => {
	it('numbers yesterday y1… in the given order and maps each ref to its entry id', () => {
		const { earlier, copyRefIds } = buildEarlierContext({
			text: 'як вчора',
			yesterday: [toEntry('a', 'Омлет', { type: 'BREAKFAST' }), toEntry('b', 'Суп')],
			recent: [],
		})

		expect(earlier).toEqual([
			{
				ref: 'y1',
				date: '2026-10-18',
				mealType: 'BREAKFAST',
				name: 'Омлет',
				grams: 150,
				kcal: 200,
			},
			{ ref: 'y2', date: '2026-10-18', mealType: 'LUNCH', name: 'Суп', grams: 150, kcal: 200 },
		])
		expect([...copyRefIds]).toEqual([
			['y1', 'a'],
			['y2', 'b'],
		])
	})

	it('shows at most 15 entries of yesterday', () => {
		const yesterday = Array.from({ length: 20 }, (_, index) => toEntry(`e${index}`, `Їжа ${index}`))

		const { earlier } = buildEarlierContext({ text: 'як вчора', yesterday, recent: [] })

		expect(earlier).toHaveLength(15)
		expect(earlier.at(-1)?.ref).toBe('y15')
	})

	it('adds the newest older entries whose food the message names, h1… after y…', () => {
		const { earlier, copyRefIds } = buildEarlierContext({
			text: 'гречку як минулого разу',
			yesterday: [toEntry('y', 'Суп')],
			recent: [
				toEntry('r1', 'Гречка варена', { date: '2026-10-15', grams: 200 }),
				toEntry('r2', 'Борщ', { date: '2026-10-14' }),
				toEntry('r3', 'Гречка', { date: '2026-10-10', grams: 180 }),
			],
		})

		expect(earlier.map(({ ref, name }) => [ref, name])).toEqual([
			['y1', 'Суп'],
			['h1', 'Гречка'],
		])
		expect(copyRefIds.get('h1')).toBe('r3')
	})

	it('matches Ukrainian endings and skips entries already listed for yesterday', () => {
		const { earlier } = buildEarlierContext({
			text: 'знову гречки',
			yesterday: [toEntry('same', 'Гречка')],
			recent: [toEntry('same', 'Гречка'), toEntry('older', 'Гречка', { date: '2026-10-12' })],
		})

		expect(earlier.map(({ ref }) => ref)).toEqual(['y1', 'h1'])
	})

	it('drops repeats of the same dish and portion, and caps at 5', () => {
		const recent = [
			...Array.from({ length: 3 }, (_, index) => toEntry(`d${index}`, 'Яйця', { grams: 100 })),
			...Array.from({ length: 8 }, (_, index) =>
				toEntry(`v${index}`, 'Яйця', { grams: 110 + index, kcal: 150 + index }),
			),
		]

		const { earlier } = buildEarlierContext({ text: 'знову яйця', yesterday: [], recent })

		expect(earlier.map(({ ref }) => ref)).toEqual(['h1', 'h2', 'h3', 'h4', 'h5'])
		expect(new Set(earlier.map(({ grams }) => grams)).size).toBe(5)
	})

	it('adds nothing for a food the message does not name', () => {
		const { earlier, copyRefIds } = buildEarlierContext({
			text: 'те саме',
			yesterday: [],
			recent: [toEntry('r', 'Борщ')],
		})

		expect(earlier).toEqual([])
		expect(copyRefIds.size).toBe(0)
	})
})
