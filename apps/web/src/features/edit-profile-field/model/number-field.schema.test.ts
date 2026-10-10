import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { createNumberFieldSchema } from './number-field.schema'

const t = ((key: string) => key) as unknown as TFunction
const decimal = createNumberFieldSchema(t, { isInteger: false, min: 30, max: 300 })
const age = createNumberFieldSchema(t, { isInteger: true, min: 18, max: 100 })

describe('createNumberFieldSchema', () => {
	it('reads a decimal comma', () => {
		expect(decimal.parse({ value: '82,4' }).value).toBe(82.4)
	})

	it('reads a decimal dot', () => {
		expect(decimal.parse({ value: '82.4' }).value).toBe(82.4)
	})

	it('asks for a number when the text is not one', () => {
		expect(decimal.safeParse({ value: 'abc' }).error?.issues[0]?.message).toBe(
			'profile.data.edit.validation.number',
		)
	})

	it('asks for a value when empty', () => {
		expect(decimal.safeParse({ value: '  ' }).error?.issues[0]?.message).toBe(
			'profile.data.edit.validation.required',
		)
	})

	it('rejects a fraction for a whole-number field', () => {
		expect(age.safeParse({ value: '30,5' }).error?.issues[0]?.message).toBe(
			'profile.data.edit.validation.integer',
		)
	})

	it('rejects values outside the range', () => {
		expect(age.safeParse({ value: '10' }).error?.issues[0]?.message).toBe(
			'profile.data.edit.validation.range',
		)
		expect(decimal.safeParse({ value: '301' }).error?.issues[0]?.message).toBe(
			'profile.data.edit.validation.range',
		)
	})
})
