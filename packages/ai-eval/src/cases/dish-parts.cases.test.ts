import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'
import { DISH_PARTS_CASES } from './dish-parts.cases.js'
import { REPO_CASES } from './index.js'

const byId = (id: string) => {
	const found = DISH_PARTS_CASES.find((item) => item.id === id)
	if (!found) throw new Error(`no case ${id}`)
	return found
}

describe('dish parts cases', () => {
	it('are the four cases of stage 0.11.6, valid, with ids unique across the repo set', () => {
		expect(DISH_PARTS_CASES).toHaveLength(4)
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of DISH_PARTS_CASES) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
		}
	})

	it('want 2–3 parts and no item named after the dish', () => {
		for (const id of ['dish-parts-canape', 'dish-parts-colon', 'dish-parts-sandwich-weights']) {
			const { expect: want } = byId(id)
			expect(want.decision, id).toBe('log')
			expect(want.minItems, id).toBe(2)
			expect(want.maxItems, id).toBe(3)
			expect(want.itemNameExcludes?.length, id).toBeGreaterThan(0)
		}
		expect(byId('dish-parts-canape').expect.itemNameExcludes).toEqual(['канапк'])
		expect(byId('dish-parts-sandwich-weights').expect.itemNameExcludes).toEqual(['бутерброд'])
	})

	it('keep the kcal ranges of the brief', () => {
		expect(byId('dish-parts-canape').expect.kcal).toEqual({ min: 70, max: 260 })
		expect(byId('dish-parts-sandwich-weights').expect.kcal).toEqual({ min: 230, max: 330 })
	})

	it('keep the borscht control at two items at most', () => {
		expect(byId('dish-parts-borscht-sour-cream').expect.maxItems).toBe(2)
	})

	it('leave the single-item toast regression in the repo set', () => {
		const toast = REPO_CASES.find(({ id }) => id === 'cat-toast')
		expect(toast?.text).toBe('бутерброд з сиром і шинкою')
		expect(toast?.expect.categories).toEqual(['toast'])
	})
})
