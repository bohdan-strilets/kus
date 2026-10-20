import { describe, expect, it } from 'vitest'

import { isDecisionCorrect } from '../metrics.js'
import { DATE_CASES } from './date.cases.js'

const getCase = (id: string) => {
	const found = DATE_CASES.find((evalCase) => evalCase.id === id)
	if (!found) throw new Error(`Missing case ${id}`)
	return found
}

describe('date-last-week reply check', () => {
	const evalCase = getCase('date-last-week')

	it.each([
		'Нічого не записав: це надто давно.',
		'Я не записав цю шаурму, давнувато.',
		'Не додав.',
	])('accepts a denial: %s', (reply) => {
		expect(isDecisionCorrect(evalCase, 'reply', reply)).toBe(true)
	})

	it.each(['Записав у понеділок шаурму.', 'Додав на 28.09 шаурму.', 'Записано на понеділок.'])(
		'rejects a claim of a created record: %s',
		(reply) => {
			expect(isDecisionCorrect(evalCase, 'reply', reply)).toBe(false)
		},
	)
})

describe('date-unclear-na-dnyakh reply check', () => {
	const evalCase = getCase('date-unclear-na-dnyakh')

	it.each([
		'Який саме день це був?',
		'Який саме це був день?',
		'Який це був день?',
		'В який день це було?',
		'Коли саме?',
	])('accepts a question about the day: %s', (reply) => {
		expect(isDecisionCorrect(evalCase, 'reply', reply)).toBe(true)
	})

	it('rejects a reply without a question about the day', () => {
		expect(isDecisionCorrect(evalCase, 'reply', 'Смачного! Шаурма — ситна страва.')).toBe(false)
	})
})
