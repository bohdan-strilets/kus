import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'
import { REPO_CASES } from './index.js'
import { MEMORY_FACT_CASES } from './memory-facts.cases.js'
import { MEMORY_FOOD_CASES } from './memory-foods.cases.js'

describe('memory cases', () => {
	it('are valid cases with unique ids', () => {
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of [...MEMORY_FOOD_CASES, ...MEMORY_FACT_CASES]) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
		}
	})

	it('keep the facts of a case with refs f1…', () => {
		const forget = MEMORY_FACT_CASES.find(({ id }) => id === 'fact-forget')
		expect(forget?.expect.memory?.forgets).toEqual(['f1'])
	})
})
