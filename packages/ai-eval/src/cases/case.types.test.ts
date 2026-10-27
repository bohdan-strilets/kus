import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'
import { HISTORY_CARD_CASES } from './history-cards.cases.js'
import { REPO_CASES } from './index.js'

const base = { id: 'c', expect: { decision: 'log' }, reference: 'r' }

describe('evalCaseSchema', () => {
	it('takes words, a photo, or both', () => {
		expect(evalCaseSchema.safeParse({ ...base, text: '150 г' }).success).toBe(true)
		expect(evalCaseSchema.safeParse({ ...base, image: 'photos/skyr.jpg' }).success).toBe(true)
		expect(
			evalCaseSchema.safeParse({ ...base, text: '150 г', image: 'photos/skyr.jpg' }).success,
		).toBe(true)
	})

	it('needs at least one of them', () => {
		expect(evalCaseSchema.safeParse(base).success).toBe(false)
		expect(evalCaseSchema.safeParse({ ...base, text: '' }).success).toBe(false)
	})

	it('reads a photo-only case with an empty text', () => {
		const parsed = evalCaseSchema.parse({ ...base, image: 'photos/skyr.jpg' })
		expect(parsed.text).toBe('')
	})

	it('accepts expected sources and photo_unusable', () => {
		const parsed = evalCaseSchema.parse({
			...base,
			image: 'photos/skyr.jpg',
			expect: { decision: 'photo_unusable', sources: ['LABEL'] },
		})
		expect(parsed.expect).toMatchObject({ decision: 'photo_unusable', sources: ['LABEL'] })
	})
})

describe('evalCaseSchema day expectations', () => {
	it('accepts the day card decision and the date fields', () => {
		const parsed = evalCaseSchema.parse({
			...base,
			text: 'що було вчора?',
			expect: {
				decision: 'day_card',
				dayCard: { date: '2026-10-06' },
				logDate: '2026-10-06',
				maxItems: 1,
				itemDates: [{ stem: 'піц', date: '2026-10-06' }],
				deletedMeasurements: [{ kind: 'WEIGHT', date: '2026-10-06' }],
			},
		})
		expect(parsed.expect.decision).toBe('day_card')
	})

	it('rejects a malformed date', () => {
		const result = evalCaseSchema.safeParse({
			...base,
			text: 'x',
			expect: { decision: 'log', logDate: '06.10.2026' },
		})
		expect(result.success).toBe(false)
	})
})

describe('history card cases', () => {
	it('are valid cases with unique ids across the repo set', () => {
		for (const item of HISTORY_CARD_CASES) expect(evalCaseSchema.safeParse(item).success).toBe(true)
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('accepts the close_day, stats and copyRefs expectations', () => {
		const parsed = evalCaseSchema.parse({
			...base,
			text: 'x',
			expect: {
				decision: 'close_day',
				closeDay: { date: '2026-10-06', estimatedTotalKcal: 4000 },
				stats: { days: 7 },
				copyRefs: ['y1', 'h2'],
			},
		})
		expect(parsed.expect.copyRefs).toEqual(['y1', 'h2'])
		expect(
			evalCaseSchema.safeParse({
				...base,
				text: 'x',
				expect: { decision: 'log', copyRefs: ['m1'] },
			}).success,
		).toBe(false)
	})
})
