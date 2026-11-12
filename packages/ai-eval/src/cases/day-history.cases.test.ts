import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'
import { DAY_HISTORY_CASES } from './day-history.cases.js'
import { REPO_CASES } from './index.js'

const byId = (id: string) => {
	const found = DAY_HISTORY_CASES.find((item) => item.id === id)
	if (!found) throw new Error(`no case ${id}`)
	return found
}

describe('day history cases', () => {
	it('are the cases of step 2.1a and the short-answer fix, valid, with ids unique across the repo set', () => {
		expect(DAY_HISTORY_CASES).toHaveLength(4)
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of DAY_HISTORY_CASES) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
		}
	})

	it('put the proposal in the last sentence of a reply over 1500 characters', () => {
		const reply = byId('long-reply-proposal-yes').context?.history?.at(-1)
		expect(reply?.role).toBe('assistant')
		expect(reply?.content.length).toBeGreaterThan(1500)
		expect(reply?.content.endsWith('Хочеш, запишу омлет з 3 яєць із сиром ≈ 420 ккал?')).toBe(true)
		expect(byId('long-reply-proposal-yes').expect.kcal).toEqual({ min: 350, max: 500 })
	})

	it('name the lunch in the 2nd user message of 12', () => {
		const history = byId('day-recall-beyond-six').context?.history ?? []
		expect(history).toHaveLength(12)
		const userMessages = history.filter(({ role }) => role === 'user')
		expect(userMessages[1]?.content).toContain('гречка 200 г і котлета')
		expect(history.slice(-6).some(({ content }) => content.includes('гречка'))).toBe(false)
	})
})
