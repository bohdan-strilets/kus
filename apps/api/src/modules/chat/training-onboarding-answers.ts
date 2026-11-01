import {
	formatOnboardingAnswers,
	trainingActivitySchema,
	trainingEquipmentSchema,
	trainingLevelSchema,
	trainingPerWeekSchema,
	trainingPlaceSchema,
} from '@kus/shared'

/**
 * The five answers as «Program» reads them, or null when one of them is missing or not a value of
 * its question (step → answer of questions 1–4, the last one's values).
 */
export const formatCollectedAnswers = (
	answers: ReadonlyMap<number, string[]>,
	lastValues: readonly string[],
): string | null => {
	const [place, activity, level, perWeek] = [1, 2, 3, 4].map((step) => answers.get(step)?.[0])
	const parsed = {
		place: trainingPlaceSchema.safeParse(place),
		activity: trainingActivitySchema.safeParse(activity),
		level: trainingLevelSchema.safeParse(level),
		perWeek: trainingPerWeekSchema.safeParse(perWeek),
		equipment: trainingEquipmentSchema.array().safeParse(lastValues),
	}
	if (
		!parsed.place.success ||
		!parsed.activity.success ||
		!parsed.level.success ||
		!parsed.perWeek.success ||
		!parsed.equipment.success
	) {
		return null
	}
	return formatOnboardingAnswers({
		place: parsed.place.data,
		activity: parsed.activity.data,
		level: parsed.level.data,
		perWeek: parsed.perWeek.data,
		equipment: parsed.equipment.data,
	})
}
