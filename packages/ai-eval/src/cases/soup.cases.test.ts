import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'
import { REPO_CASES } from './index.js'
import { SOUP_CASES } from './soup.cases.js'

const byId = (id: string) => {
	const found = SOUP_CASES.find((item) => item.id === id)
	if (!found) throw new Error(`no case ${id}`)
	return found
}

describe('soup cases', () => {
	it('are the eight cases of stage 0.11.1, valid, with ids unique across the repo set', () => {
		expect(SOUP_CASES).toHaveLength(8)
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of SOUP_CASES) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
		}
	})

	it('hold no personal data: made-up names only, no emails or phones', () => {
		const dump = JSON.stringify(SOUP_CASES)
		expect(dump).not.toMatch(/@|\+\d{6,}/)
	})

	it('ask about the water only when the pot is weighed dry and the water is unknown', () => {
		expect(byId('soup-pot-incident').expect.decision).toBe('clarify')
		expect(byId('soup-pot-with-water').expect.decision).toBe('log')
		expect(byId('soup-pot-weighed').expect.decision).toBe('log')
	})

	it('show a recipe only from the history, never invent one', () => {
		const none = byId('recipe-show-none')
		expect(none.context?.history).toBeUndefined()
		expect(none.expect.replyExcludes).toContain('2 л')
		const fromHistory = byId('recipe-show-from-history')
		expect(fromHistory.expect.replyIncludes).toEqual(['410'])
		expect(fromHistory.context?.history?.[0]?.content).toContain('410г')
	})

	it('log the saved soup from the memory with no lookup', () => {
		expect(byId('soup-again-memory').expect).toMatchObject({
			memoryRefs: ['m1'],
			findFoodCalled: false,
		})
	})
})
