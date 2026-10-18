import type { MeasurementKind } from '@kus/shared'
import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { createEditMeasurementSchema } from './edit-measurement.schema'

const t = i18n.t.bind(i18n) as TFunction

const getMessage = (kind: MeasurementKind, value: string): string | undefined => {
	const result = createEditMeasurementSchema(t, kind).safeParse({ value })
	return result.success ? undefined : result.error.issues[0]?.message
}

describe('createEditMeasurementSchema', () => {
	it('accepts a value with a comma or a dot', () => {
		const schema = createEditMeasurementSchema(t, 'WEIGHT')

		expect(schema.parse({ value: '81,9' }).value).toBe(81.9)
		expect(schema.parse({ value: '81.9' }).value).toBe(81.9)
	})

	it('names the bounds of the weight', () => {
		expect(getMessage('WEIGHT', '29')).toBe('Не менше 30 кг')
		expect(getMessage('WEIGHT', '301')).toBe('Не більше 300 кг')
	})

	it('names the bounds of the waist', () => {
		expect(getMessage('WAIST', '39')).toBe('Не менше 40 см')
		expect(getMessage('WAIST', '201')).toBe('Не більше 200 см')
	})

	it('asks for a number', () => {
		expect(getMessage('WEIGHT', '')).toBe('Вкажи число')
		expect(getMessage('WEIGHT', 'abc')).toBe('Лише число, наприклад 82,4')
	})
})
