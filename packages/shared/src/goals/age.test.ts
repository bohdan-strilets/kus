import { describe, expect, it } from 'vitest'

import { getAgeFromBirthYear, getBirthYearFromAge } from './age.js'

describe('age ↔ birth year', () => {
	it('reads back the age that was saved, in the same year', () => {
		const currentYear = 2026
		for (const age of [18, 30, 100]) {
			const birthYear = getBirthYearFromAge(age, currentYear)
			expect(getAgeFromBirthYear(birthYear, currentYear)).toBe(age)
		}
	})

	it('converts the seed: 30 years in 2026 → born 1996', () => {
		expect(getBirthYearFromAge(30, 2026)).toBe(1996)
		expect(getAgeFromBirthYear(1996, 2026)).toBe(30)
	})
})
