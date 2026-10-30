import type { FactCategory, FactResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { groupFacts } from './group-facts'

const createFact = (text: string, category: FactCategory, createdAt: string): FactResponse => ({
	id: '0199b3a4-0000-7000-8000-000000000001',
	text,
	category,
	status: 'CONFIRMED',
	createdAt,
})

describe('groupFacts', () => {
	it('orders groups as schedule, food, training, other and leaves out the empty ones', () => {
		const groups = groupFacts([
			createFact('Не їсть рибу', 'FOOD', '2026-10-12T10:00:00.000Z'),
			createFact('Інше', 'OTHER', '2026-10-12T10:00:00.000Z'),
			createFact('Змінний графік', 'SCHEDULE', '2026-10-12T10:00:00.000Z'),
		])

		expect(groups.map((group) => group.category)).toEqual(['SCHEDULE', 'FOOD', 'OTHER'])
	})

	it('puts the older fact first inside a group', () => {
		const [group] = groupFacts([
			createFact('Новіший', 'FOOD', '2026-10-15T10:00:00.000Z'),
			createFact('Старіший', 'FOOD', '2026-10-09T10:00:00.000Z'),
		])

		expect(group?.facts.map((fact) => fact.text)).toEqual(['Старіший', 'Новіший'])
	})

	it('gives no groups for no facts', () => {
		expect(groupFacts([])).toEqual([])
	})
})
