import { describe, expect, it } from 'vitest'

import { formatCollectedAnswers } from './training-onboarding-answers'

const ANSWERS = new Map([
	[1, ['GYM']],
	[2, ['STRENGTH']],
	[3, ['BEGINNER']],
	[4, ['3']],
])

describe('formatCollectedAnswers', () => {
	it('writes the five answers', () => {
		const text = formatCollectedAnswers(ANSWERS, ['FULL_GYM'])
		expect(text).toContain('place GYM')
		expect(text).toContain('equipment FULL_GYM')
	})

	it('is null when an answer of questions 1–4 is missing', () => {
		const answers = new Map(ANSWERS)
		answers.delete(3)
		expect(formatCollectedAnswers(answers, ['FULL_GYM'])).toBeNull()
	})

	it("is null when a value is not the question's", () => {
		expect(formatCollectedAnswers(new Map([...ANSWERS, [1, ['NOWHERE']]]), ['FULL_GYM'])).toBeNull()
		expect(formatCollectedAnswers(ANSWERS, ['NOT_EQUIPMENT'])).toBeNull()
	})
})
