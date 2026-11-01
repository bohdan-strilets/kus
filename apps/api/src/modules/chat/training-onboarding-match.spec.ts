import { describe, expect, it } from 'vitest'

import { matchOnboardingAnswer } from './training-onboarding-match'

describe('matchOnboardingAnswer', () => {
	it('reads each single-choice label of its own question', () => {
		expect(matchOnboardingAnswer(1, 'Зал')).toEqual(['GYM'])
		expect(matchOnboardingAnswer(1, 'По-різному')).toEqual(['MIXED'])
		expect(matchOnboardingAnswer(2, 'Силові й кардіо')).toEqual(['STRENGTH_AND_CARDIO'])
		expect(matchOnboardingAnswer(2, 'Поки нічого')).toEqual(['NOTHING_YET'])
		expect(matchOnboardingAnswer(3, 'Є досвід')).toEqual(['EXPERIENCED'])
	})

	it('ignores case, spaces around and final punctuation', () => {
		expect(matchOnboardingAnswer(1, '  вдома! ')).toEqual(['HOME'])
		expect(matchOnboardingAnswer(1, 'НА   ВУЛИЦІ.')).toEqual(['OUTDOOR'])
		expect(matchOnboardingAnswer(3, 'впевнено…')).toEqual(['CONFIDENT'])
	})

	it('does not take a label of another question or a longer sentence', () => {
		expect(matchOnboardingAnswer(2, 'Зал')).toBeNull()
		expect(matchOnboardingAnswer(1, 'зал біля дому')).toBeNull()
		expect(matchOnboardingAnswer(1, 'а яка різниця?')).toBeNull()
	})

	it('reads the number of workouts a week: 2–4 as is, 5 and «5+» as 5+', () => {
		expect(matchOnboardingAnswer(4, '2')).toEqual(['2'])
		expect(matchOnboardingAnswer(4, '4.')).toEqual(['4'])
		expect(matchOnboardingAnswer(4, '5')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, '5+')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, '1')).toBeNull()
		expect(matchOnboardingAnswer(4, '6')).toBeNull()
		expect(matchOnboardingAnswer(4, '3+')).toBeNull()
		expect(matchOnboardingAnswer(4, '3 рази')).toBeNull()
	})

	it('reads one piece of equipment or a list of them, in the order of the buttons', () => {
		expect(matchOnboardingAnswer(5, 'гантелі')).toEqual(['DUMBBELLS'])
		expect(matchOnboardingAnswer(5, 'Турнік, гантелі')).toEqual(['DUMBBELLS', 'PULL_UP_BAR'])
		expect(matchOnboardingAnswer(5, 'гумки і турнік')).toEqual(['PULL_UP_BAR', 'BANDS'])
		expect(matchOnboardingAnswer(5, 'Повний зал, гантелі та гумки.')).toEqual([
			'FULL_GYM',
			'DUMBBELLS',
			'BANDS',
		])
		expect(matchOnboardingAnswer(5, 'гантелі, гантелі')).toEqual(['DUMBBELLS'])
	})

	it('takes «Нічого» only alone and refuses a list with an unknown item', () => {
		expect(matchOnboardingAnswer(5, 'нічого')).toEqual(['NONE'])
		expect(matchOnboardingAnswer(5, 'нічого, гумки')).toBeNull()
		expect(matchOnboardingAnswer(5, 'гантелі і бігова доріжка')).toBeNull()
	})
})
