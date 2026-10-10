import { describe, expect, it } from 'vitest'

import { getWelcomeBackText } from './welcome-back-text'

describe('getWelcomeBackText', () => {
	it('greets by the vocative of the name', () => {
		expect(getWelcomeBackText({ name: 'Богдан', addressAs: null, locale: 'uk' })).toBe(
			'З поверненням, Богдане! Усе на місці, як і було. Пиши, що їси — я порахую.',
		)
	})

	it('takes «Як до тебе звертатися?» over the name', () => {
		expect(getWelcomeBackText({ name: 'Богдан', addressAs: 'Бо', locale: 'uk' })).toBe(
			'З поверненням, Бо! Усе на місці, як і було. Пиши, що їси — я порахую.',
		)
	})

	it('goes without a name when no form is safe', () => {
		const expected = 'З поверненням! Усе на місці, як і було. Пиши, що їси — я порахую.'
		expect(getWelcomeBackText({ name: 'Bohdan', addressAs: null, locale: 'uk' })).toBe(expected)
		expect(getWelcomeBackText({ name: null, addressAs: '  ', locale: 'uk' })).toBe(expected)
	})
})
