import { WORKOUT_SUMMARY_TEXT } from './chat.constants'

const fill = (template: string, values: Record<string, string>): string =>
	Object.entries(values).reduce(
		// a function, so a «$» in a user's name is never read as a replacement pattern
		(text, [key, value]) => text.replace(`{{${key}}}`, () => value),
		template,
	)

/**
 * Kusik's words over the summary card: «Записав …» (or «Закрив … — …» for the auto-close), then the
 * records: the exercise for one, the count for several.
 */
export const getWorkoutSummaryText = ({
	templateName,
	recordExerciseNames,
	isAutoClosed,
}: {
	templateName: string | null
	/** One name per exercise that set a record, in the session's order. */
	recordExerciseNames: readonly string[]
	isAutoClosed: boolean
}): string => {
	const first = isAutoClosed
		? fill(WORKOUT_SUMMARY_TEXT.autoClosed, {
				name: templateName ?? WORKOUT_SUMMARY_TEXT.autoClosedUnnamed,
			})
		: templateName === null
			? WORKOUT_SUMMARY_TEXT.unnamed
			: fill(WORKOUT_SUMMARY_TEXT.named, { name: templateName })
	const [onlyRecord] = recordExerciseNames
	if (onlyRecord === undefined) return first
	const records =
		recordExerciseNames.length === 1
			? fill(WORKOUT_SUMMARY_TEXT.oneRecord, { exercise: onlyRecord })
			: fill(WORKOUT_SUMMARY_TEXT.manyRecords, { count: String(recordExerciseNames.length) })
	return `${first} ${records}`
}
