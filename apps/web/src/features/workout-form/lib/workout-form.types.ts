import type { ExerciseKind, MuscleGroup } from '@kus/shared'

export interface FormSetValue {
	/** Key of the row in a list: local only (never sent, not compared with the plan). */
	rowKey: string
	/** `rowKey` of the plan set this one was made from; null for a set the person added. Local only. */
	planKey: string | null
	reps: number | null
	weightKg: number | null
	durationSec: number | null
	distanceM: number | null
	isWarmup: boolean
}

/** The template's own answer for the exercise: what «Як за планом» brings back. */
export interface FormExercisePlan {
	sets: FormSetValue[]
	durationMin: number | null
	distanceM: number | null
	/** What the dictionary knows; the person's own choice is on the exercise itself. */
	isBodyweight: boolean | null
}

/**
 * Where an exercise stands against the plan; derived, never stored. ADDED has no plan to compare
 * with (picked in «+ Вправа»), so it is neither «as planned» nor «changed».
 */
export type FormExerciseState = 'PLANNED' | 'CHANGED' | 'SKIPPED' | 'ADDED'

export interface FormExerciseValue {
	/** Key of the row in a list. */
	key: string
	exerciseId: string | null
	templateExerciseId: string | null
	name: string
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
	/** null = not known; true = no weight on any set. */
	isBodyweight: boolean | null
	durationMin: number | null
	distanceM: number | null
	sets: FormSetValue[]
	/** «не робили»: the exercise stays in the form (it can come back) but is not sent. */
	isSkipped: boolean
	/** null for an exercise the person added: it has no plan to return to. */
	plan: FormExercisePlan | null
}

export interface WorkoutFormValues {
	/** `YYYY-MM-DD`, today or up to `FORM_MAX_DAYS_BACK` days back. */
	localDate: string
	/** `HH:mm` in the user's time zone. */
	startTime: string
	/** null while the field is empty. */
	durationMin: number | null
	exercises: FormExerciseValue[]
}

/** The user's current moment in their time zone. */
export interface FormNow {
	localDate: string
	/** `HH:mm`. */
	time: string
}
