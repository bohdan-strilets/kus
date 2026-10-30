import { formatContext } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { toFoodContext } from './case-context.js'
import { BASE_CONTEXT } from './run-case.js'

describe('toFoodContext', () => {
	it('numbers the fact texts f1… in order', () => {
		expect(toFoodContext({ facts: ['Не їсть рибу', 'Спить до восьмої'] }).facts).toEqual([
			{ ref: 'f1', text: 'Не їсть рибу' },
			{ ref: 'f2', text: 'Спить до восьмої' },
		])
	})

	it('keeps the rest of the context and adds no facts when the case has none', () => {
		const context = toFoodContext({ proposedFact: 'Тренується вранці' })

		expect(context).toEqual({ proposedFact: 'Тренується вранці' })
		expect(toFoodContext(undefined)).toEqual({})
	})

	it('reaches the model context as the User facts block', () => {
		const text = formatContext({
			...BASE_CONTEXT,
			...toFoodContext({ facts: ['Не їсть рибу'], proposedFact: 'Тренується вранці' }),
		})

		expect(text).toContain('- f1 "Не їсть рибу"')
		expect(text).toContain('Proposed fact (waiting for the user\'s answer): "Тренується вранці"')
	})
})
