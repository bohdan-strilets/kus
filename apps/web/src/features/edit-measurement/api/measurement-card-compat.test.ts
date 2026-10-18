import { measurementCardSchema } from '@kus/shared'
import { describe, expect, it } from 'vitest'

const OLD_API_CARD = {
	id: '0199b3a4-0000-7000-8000-000000000001',
	kind: 'WEIGHT',
	value: 82.4,
	localDate: '2026-10-18',
	source: 'CHAT',
	fromStart: -1.6,
	toGoal: 4.4,
	isGoalReached: false,
	weekChange: -0.4,
	planPaceKgPerWeek: 0.25,
	chart: [{ localDate: '2026-10-18', value: 82.4 }],
}

describe('measurement card from an older API', () => {
	// the web may be deployed before the API: the new fields are read as «not deleted, no time»
	it('reads a card without isDeleted and measuredAt', () => {
		const card = measurementCardSchema.parse(OLD_API_CARD)

		expect(card.isDeleted).toBe(false)
		expect(card.measuredAt).toBeNull()
	})

	it('keeps what the new API sends', () => {
		const card = measurementCardSchema.parse({
			...OLD_API_CARD,
			isDeleted: true,
			measuredAt: '2026-10-18T06:10:00.000Z',
		})

		expect(card.isDeleted).toBe(true)
		expect(card.measuredAt).toBe('2026-10-18T06:10:00.000Z')
	})
})
