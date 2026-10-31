import { matchMuscleGroup, type MuscleGroup } from '@kus/shared'

export type BackfillExercise = { id: string; name: string; muscleGroup: MuscleGroup | null }

export interface MuscleGroupBackfillPlan {
	/** Exercises that already have a group: left as they are. */
	withGroup: number
	/** Exercises without a group that the dictionary of names knows. */
	fromDictionary: { id: string; muscleGroup: MuscleGroup }[]
	/** Names the dictionary does not know, unique and sorted: the person decides. */
	unmatchedNames: string[]
}

/** What the backfill does with strength / other exercises: a group already set is never changed. */
export const planMuscleGroupBackfill = (
	exercises: readonly BackfillExercise[],
): MuscleGroupBackfillPlan => {
	const fromDictionary: MuscleGroupBackfillPlan['fromDictionary'] = []
	const unmatched = new Set<string>()
	let withGroup = 0
	for (const exercise of exercises) {
		if (exercise.muscleGroup !== null) {
			withGroup += 1
			continue
		}
		const muscleGroup = matchMuscleGroup(exercise.name)
		if (muscleGroup === null) unmatched.add(exercise.name)
		else fromDictionary.push({ id: exercise.id, muscleGroup })
	}
	return {
		withGroup,
		fromDictionary,
		unmatchedNames: [...unmatched].sort((a, b) => a.localeCompare(b, 'uk')),
	}
}

/** The ids to update per group, so the apply step runs one query per group. */
export const groupIdsByMuscleGroup = (
	items: MuscleGroupBackfillPlan['fromDictionary'],
): Map<MuscleGroup, string[]> => {
	const byGroup = new Map<MuscleGroup, string[]>()
	for (const { id, muscleGroup } of items) {
		byGroup.set(muscleGroup, [...(byGroup.get(muscleGroup) ?? []), id])
	}
	return byGroup
}
