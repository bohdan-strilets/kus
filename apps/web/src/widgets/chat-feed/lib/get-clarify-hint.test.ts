import { describe, expect, it } from 'vitest'

import { getClarifyHint } from './get-clarify-hint'

const option = (label: string, kcal: number) => ({ label, kcal })

describe('getClarifyHint', () => {
	it('asks about the answer that differs from what was logged', () => {
		const buckwheat = { options: [option('Варена', 110), option('Суха', 343)] }
		expect(getClarifyHint(buckwheat, 110)).toBe('суха?')
		expect(getClarifyHint(buckwheat, 343)).toBe('варена?')
	})

	it('has no single doubt with more than two answers', () => {
		const soup = { options: [option('Мала', 100), option('Середня', 200), option('Велика', 300)] }
		expect(getClarifyHint(soup, 200)).toBeNull()
	})
})
