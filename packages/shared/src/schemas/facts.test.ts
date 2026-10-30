import { describe, expect, it } from 'vitest'

import { FACT_TEXT_MAX_LENGTH, updateFactRequestSchema } from './facts.js'

const parseText = (text: string) => updateFactRequestSchema.safeParse({ text })

describe('updateFactRequestSchema', () => {
	it('keeps a fact on one line with single spaces', () => {
		const result = parseText("  Не їсть\nрибу,\n\nі   м'ясо  ")

		expect(result.success && result.data.text).toBe("Не їсть рибу, і м'ясо")
	})

	it('counts the length after collapsing spaces', () => {
		expect(parseText(`${'а'.repeat(FACT_TEXT_MAX_LENGTH)}   `).success).toBe(true)
		expect(parseText('а'.repeat(FACT_TEXT_MAX_LENGTH + 1)).success).toBe(false)
	})

	it('rejects an empty fact', () => {
		expect(parseText(' \n ').success).toBe(false)
	})

	it('names the guard issue in the error', () => {
		const result = parseText('Алергія на горіхи')

		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.message).toBe('HEALTH_DATA')
	})
})
