import type { FactCategory, FactResponse } from '@kus/shared'

/** «Графік», «Їжа», «Тренування» as in mockups/memory-facts.html; «Інше» goes last. */
export const FACT_GROUP_ORDER: readonly FactCategory[] = ['SCHEDULE', 'FOOD', 'TRAINING', 'OTHER']

export interface FactGroup {
	category: FactCategory
	facts: FactResponse[]
}

const byCreatedAt = (a: FactResponse, b: FactResponse): number =>
	a.createdAt.localeCompare(b.createdAt)

/** Only the groups that have facts, in the fixed order; inside a group the oldest first. */
export const groupFacts = (facts: readonly FactResponse[]): FactGroup[] =>
	FACT_GROUP_ORDER.map((category) => ({
		category,
		facts: facts.filter((fact) => fact.category === category).sort(byCreatedAt),
	})).filter((group) => group.facts.length > 0)
