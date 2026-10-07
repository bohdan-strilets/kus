import { describe, expect, it } from 'vitest'

import { isFoodMentioned } from './memory-match.js'

const buckwheat = { nameNormalized: 'гречка варена', aliases: ['гречка'] }
const bar = { nameNormalized: 'протеїновий батончик olimp', aliases: ['олімп'] }

describe('isFoodMentioned', () => {
	it('matches an alias with a different ending', () => {
		expect(isFoodMentioned(buckwheat, '100 г гречки')).toBe(true)
	})

	it('matches a multi-word name in any order', () => {
		expect(isFoodMentioned(bar, 'батончик протеїновий Olimp після тренування')).toBe(true)
	})

	it('matches an alias regardless of case', () => {
		expect(isFoodMentioned(bar, 'з’їв ОЛІМП')).toBe(true)
	})

	it('does not match unrelated text', () => {
		expect(isFoodMentioned(buckwheat, '3 яйця і кава')).toBe(false)
	})

	it('ignores words shorter than 3 letters in the name', () => {
		expect(isFoodMentioned({ nameNormalized: 'чай з м', aliases: [] }, 'з м')).toBe(false)
	})
})
