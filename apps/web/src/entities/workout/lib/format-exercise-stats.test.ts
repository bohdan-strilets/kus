import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatBestSet, formatChange } from './format-exercise-stats'

const t = i18n.t.bind(i18n)

describe('formatBestSet and formatChange', () => {
	it('writes weight×reps, or reps for a bodyweight exercise', () => {
		expect(formatBestSet({ weightKg: 77.5, reps: 5, localDate: '2026-10-01' }, t)).toBe(
			'77,5 кг × 5',
		)
		expect(formatBestSet({ weightKg: null, reps: 9, localDate: '2026-10-01' }, t)).toBe('9 повт.')
		expect(formatBestSet(null, t)).toBeNull()
	})

	it('writes the change with a real minus, «без змін» for zero and nothing for null', () => {
		expect(formatChange({ change: 10, isBodyweight: false }, t)).toBe('+10 кг')
		expect(formatChange({ change: -2.5, isBodyweight: false }, t)).toBe('−2,5 кг')
		expect(formatChange({ change: 2, isBodyweight: true }, t)).toBe('+2 повт.')
		expect(formatChange({ change: 0, isBodyweight: true }, t)).toBe('без змін')
		expect(formatChange({ change: null, isBodyweight: false }, t)).toBeNull()
	})
})
