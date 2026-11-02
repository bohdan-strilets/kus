import { WORKOUT_APPEND_MAX_GAP_HOURS } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { WORKOUT_SUMMARY_TEXT } from './chat.constants'
import { getWorkoutSummaryText } from './workout-summary-text'

const FORBIDDEN = ["можна з'їсти ще", 'доїж', 'дефіцит', 'заробив', 'спалив']

const expectNoForbiddenWord = (text: string): void => {
	for (const word of FORBIDDEN) expect(text.toLowerCase()).not.toContain(word)
}

describe('WORKOUT_SUMMARY_TEXT (approved phrases)', () => {
	it('has exactly the approved wording', () => {
		expect(WORKOUT_SUMMARY_TEXT).toEqual({
			named: 'Записав {{name}}.',
			unnamed: 'Записав тренування.',
			oneRecord: 'Рекорд — {{exercise}}.',
			manyRecords: 'Нових рекордів: {{count}}.',
			autoClosed: 'Закрив {{name}} — після останнього підходу минуло понад 3 години.',
			autoClosedUnnamed: 'тренування',
		})
	})

	it('names the same gap as the append rule', () => {
		expect(WORKOUT_APPEND_MAX_GAP_HOURS).toBe(3)
	})

	it('contains none of the forbidden words in any phrase', () => {
		for (const phrase of Object.values(WORKOUT_SUMMARY_TEXT)) expectNoForbiddenWord(phrase)
	})
})

describe('getWorkoutSummaryText', () => {
	const none: readonly string[] = []

	it('names the template: «Записав {name}.»', () => {
		expect(
			getWorkoutSummaryText({
				templateName: 'Верх A',
				recordExerciseNames: none,
				isAutoClosed: false,
			}),
		).toBe('Записав Верх A.')
	})

	it('without a template: «Записав тренування.»', () => {
		expect(
			getWorkoutSummaryText({ templateName: null, recordExerciseNames: none, isAutoClosed: false }),
		).toBe('Записав тренування.')
	})

	it('one record names the exercise', () => {
		expect(
			getWorkoutSummaryText({
				templateName: null,
				recordExerciseNames: ['Жим лежачи'],
				isAutoClosed: false,
			}),
		).toBe('Записав тренування. Рекорд — Жим лежачи.')
	})

	it('several records give the count', () => {
		expect(
			getWorkoutSummaryText({
				templateName: 'Низ',
				recordExerciseNames: ['Присід', 'Станова', 'Випади'],
				isAutoClosed: false,
			}),
		).toBe('Записав Низ. Нових рекордів: 3.')
	})

	it('auto-closed with a template', () => {
		expect(
			getWorkoutSummaryText({
				templateName: 'Верх A',
				recordExerciseNames: none,
				isAutoClosed: true,
			}),
		).toBe('Закрив Верх A — після останнього підходу минуло понад 3 години.')
	})

	it('auto-closed without a template says «тренування», and records follow', () => {
		expect(
			getWorkoutSummaryText({
				templateName: null,
				recordExerciseNames: ['Жим'],
				isAutoClosed: true,
			}),
		).toBe('Закрив тренування — після останнього підходу минуло понад 3 години. Рекорд — Жим.')
	})

	it('keeps «$» patterns of a user name literal', () => {
		const text = getWorkoutSummaryText({
			templateName: "День $& $1 $'",
			recordExerciseNames: ['Жим $&'],
			isAutoClosed: false,
		})
		expect(text).toBe("Записав День $& $1 $'. Рекорд — Жим $&.")
	})

	it('never contains a forbidden word', () => {
		expectNoForbiddenWord(
			getWorkoutSummaryText({
				templateName: 'A',
				recordExerciseNames: ['x', 'y'],
				isAutoClosed: false,
			}),
		)
		expectNoForbiddenWord(
			getWorkoutSummaryText({ templateName: null, recordExerciseNames: ['x'], isAutoClosed: true }),
		)
	})
})
