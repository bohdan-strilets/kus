import { describe, expect, it } from 'vitest'

import { matchOnboardingAnswer } from './training-onboarding-match'

describe('matchOnboardingAnswer', () => {
	it('reads each button label of its own question', () => {
		expect(matchOnboardingAnswer(1, 'Зал')).toEqual(['GYM'])
		expect(matchOnboardingAnswer(1, 'По-різному')).toEqual(['MIXED'])
		expect(matchOnboardingAnswer(1, 'На вулиці')).toEqual(['OUTDOOR'])
		expect(matchOnboardingAnswer(2, 'Силові й кардіо')).toEqual(['STRENGTH_AND_CARDIO'])
		expect(matchOnboardingAnswer(2, 'Поки нічого')).toEqual(['NOTHING_YET'])
		expect(matchOnboardingAnswer(3, 'Є досвід')).toEqual(['EXPERIENCED'])
		expect(matchOnboardingAnswer(3, 'Впевнено')).toEqual(['CONFIDENT'])
	})

	it('ignores case, spaces and punctuation around', () => {
		expect(matchOnboardingAnswer(1, '  вдома! ')).toEqual(['HOME'])
		expect(matchOnboardingAnswer(1, 'Дома.')).toEqual(['HOME'])
		expect(matchOnboardingAnswer(1, 'НА   ВУЛИЦІ.')).toEqual(['OUTDOOR'])
		expect(matchOnboardingAnswer(3, 'впевнено…')).toEqual(['CONFIDENT'])
	})

	it('finds the one option by its keyword in a sentence (question 1)', () => {
		expect(matchOnboardingAnswer(1, 'ходжу в зал, маю абонемент')).toEqual(['GYM'])
		expect(matchOnboardingAnswer(1, 'надворі')).toEqual(['OUTDOOR'])
		expect(matchOnboardingAnswer(1, 'на свіжому повітрі')).toEqual(['OUTDOOR'])
		expect(matchOnboardingAnswer(1, 'як вийде, по-різному')).toEqual(['MIXED'])
	})

	it('gives no answer for two options or none', () => {
		expect(matchOnboardingAnswer(1, 'то вдома, то в залі')).toBeNull()
		expect(matchOnboardingAnswer(1, 'не знаю')).toBeNull()
		expect(matchOnboardingAnswer(2, 'Зал')).toBeNull()
	})

	it('does not take a question for an answer', () => {
		expect(matchOnboardingAnswer(1, 'а яка різниця?')).toBeNull()
		expect(matchOnboardingAnswer(1, 'а яка різниця')).toBeNull()
		expect(matchOnboardingAnswer(1, 'а в чому різниця між залом і домом?')).toBeNull()
		expect(matchOnboardingAnswer(5, 'а гантелі обовʼязкові?')).toBeNull()
	})

	it('reads the combo of strength and cardio as one option (question 2)', () => {
		expect(matchOnboardingAnswer(2, 'силові і трохи кардіо')).toEqual(['STRENGTH_AND_CARDIO'])
		expect(matchOnboardingAnswer(2, 'кардіо та силові')).toEqual(['STRENGTH_AND_CARDIO'])
		expect(matchOnboardingAnswer(2, 'лише силові')).toEqual(['STRENGTH'])
		expect(matchOnboardingAnswer(2, 'кардіо')).toEqual(['CARDIO'])
		expect(matchOnboardingAnswer(2, 'нічого не робив')).toEqual(['NOTHING_YET'])
		expect(matchOnboardingAnswer(2, 'силові, поки нічого з кардіо')).toBeNull()
	})

	it('reads experience (question 3)', () => {
		expect(matchOnboardingAnswer(3, 'я новачок')).toEqual(['BEGINNER'])
		expect(matchOnboardingAnswer(3, 'без досвіду')).toEqual(['BEGINNER'])
		expect(matchOnboardingAnswer(3, 'тренуюсь кілька років')).toEqual(['CONFIDENT'])
		expect(matchOnboardingAnswer(3, 'починаю')).toEqual(['BEGINNER'])
	})

	it('reads the number of workouts a week (question 4)', () => {
		expect(matchOnboardingAnswer(4, '2')).toEqual(['2'])
		expect(matchOnboardingAnswer(4, '4.')).toEqual(['4'])
		expect(matchOnboardingAnswer(4, '3 рази')).toEqual(['3'])
		expect(matchOnboardingAnswer(4, '5')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, '5+')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, 'шість')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, '7 разів')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, 'два')).toEqual(['2'])
		expect(matchOnboardingAnswer(4, 'чотири рази')).toEqual(['4'])
		expect(matchOnboardingAnswer(4, 'п’ять')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, "п'ять")).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, 'пʼять')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, '2 або 3')).toBeNull()
		expect(matchOnboardingAnswer(4, 'два чи три')).toBeNull()
		expect(matchOnboardingAnswer(4, '1')).toBeNull()
		expect(matchOnboardingAnswer(4, '3+')).toBeNull()
		expect(matchOnboardingAnswer(4, 'часто')).toBeNull()
	})

	it('reads equipment: every option with a keyword, in the order of the buttons (question 5)', () => {
		expect(matchOnboardingAnswer(5, 'гантелі')).toEqual(['DUMBBELLS'])
		expect(matchOnboardingAnswer(5, 'Турнік, гантелі')).toEqual(['DUMBBELLS', 'PULL_UP_BAR'])
		expect(matchOnboardingAnswer(5, 'гантелі й турнік')).toEqual(['DUMBBELLS', 'PULL_UP_BAR'])
		expect(matchOnboardingAnswer(5, 'гумки і турнік')).toEqual(['PULL_UP_BAR', 'BANDS'])
		expect(matchOnboardingAnswer(5, 'є резинки')).toEqual(['BANDS'])
		expect(matchOnboardingAnswer(5, 'Повний зал, гантелі та гумки.')).toEqual([
			'FULL_GYM',
			'DUMBBELLS',
			'BANDS',
		])
		expect(matchOnboardingAnswer(5, 'ходжу в зал')).toEqual(['FULL_GYM'])
		expect(matchOnboardingAnswer(5, 'гантелі, гантелі')).toEqual(['DUMBBELLS'])
	})

	it('matches whole words only, not parts of other words', () => {
		expect(matchOnboardingAnswer(1, 'різко')).toBeNull()
		expect(matchOnboardingAnswer(1, 'різні питання')).toBeNull()
		expect(matchOnboardingAnswer(1, 'домашній варіант')).toBeNull()
		expect(matchOnboardingAnswer(1, 'не знаю, залежить від настрою')).toBeNull()
		expect(matchOnboardingAnswer(5, 'не знаю, залежить від настрою')).toBeNull()
	})

	it('reads «немає досвіду» as a beginner, not as experience (question 3)', () => {
		expect(matchOnboardingAnswer(3, 'немає досвіду')).toEqual(['BEGINNER'])
		expect(matchOnboardingAnswer(3, 'нема досвіду')).toEqual(['BEGINNER'])
	})

	it('gives no answer when a keyword is negated', () => {
		expect(matchOnboardingAnswer(3, 'не впевнений')).toBeNull()
		expect(matchOnboardingAnswer(3, 'не новачок')).toBeNull()
		expect(matchOnboardingAnswer(3, 'не тренувався кілька років')).toBeNull()
		expect(matchOnboardingAnswer(2, 'кардіо не люблю, тільки силові')).toBeNull()
		expect(matchOnboardingAnswer(5, 'зал не підходить')).toBeNull()
		expect(matchOnboardingAnswer(5, 'немає гантелей')).toBeNull()
	})

	it('counts only 2–7 a week, without a unit (question 4)', () => {
		expect(matchOnboardingAnswer(4, 'двічі')).toEqual(['2'])
		expect(matchOnboardingAnswer(4, 'тричі на тиждень')).toEqual(['3'])
		expect(matchOnboardingAnswer(4, 'сім')).toEqual(['5+'])
		expect(matchOnboardingAnswer(4, '8')).toBeNull()
		expect(matchOnboardingAnswer(4, '30 хвилин')).toBeNull()
		expect(matchOnboardingAnswer(4, '10 хв')).toBeNull()
		expect(matchOnboardingAnswer(4, '2 години')).toBeNull()
		expect(matchOnboardingAnswer(4, '3 рази на місяць')).toBeNull()
		expect(matchOnboardingAnswer(4, '3 рази на тиждень')).toEqual(['3'])
	})

	it('takes «Нічого» only alone', () => {
		expect(matchOnboardingAnswer(5, 'нічого')).toEqual(['NONE'])
		expect(matchOnboardingAnswer(5, 'немає')).toEqual(['NONE'])
		expect(matchOnboardingAnswer(5, 'нічого і гантелі')).toBeNull()
		expect(matchOnboardingAnswer(5, 'бігова доріжка')).toBeNull()
	})
})
