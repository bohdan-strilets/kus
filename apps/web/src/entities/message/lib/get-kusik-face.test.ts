import { describe, expect, it } from 'vitest'

import { getKusikFace } from './get-kusik-face'

describe('getKusikFace', () => {
	it('winks for a logged meal and a plain reply (mockups/chat.html)', () => {
		expect(getKusikFace('mealLogged')).toBe('smile')
		expect(getKusikFace('reply')).toBe('smile')
	})

	it('thinks while typing and estimating a photo', () => {
		expect(getKusikFace('typing')).toBe('think')
		expect(getKusikFace('photoEstimate')).toBe('think')
	})

	it('follows the special replies from the mockups', () => {
		expect(getKusikFace('suggestion')).toBe('happy')
		expect(getKusikFace('error')).toBe('oops')
		expect(getKusikFace('newDay')).toBe('smileOpen')
		expect(getKusikFace('weeklySummary')).toBe('smileOpen')
		expect(getKusikFace('newRecipe')).toBe('content')
		expect(getKusikFace('weight')).toBe('proud')
	})
})
