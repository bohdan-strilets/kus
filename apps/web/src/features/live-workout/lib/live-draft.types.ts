import type { ExerciseKind, MuscleGroup, ProgramLastSet } from '@kus/shared'

export interface LiveDraftSet {
	/** Key of the row in a list: local only (never in the PUT or the unsent snapshot), new after a reload. */
	rowKey: string
	reps: number | null
	weightKg: number | null
	durationSec: number | null
	distanceM: number | null
	isWarmup: boolean
	/** ISO: set when the person marks the set done; null = still to do. */
	doneAt: string | null
}

/** What the template says about the exercise, with the last time and the hint. */
export interface LiveDraftPlan {
	sets: number | null
	repsMin: number | null
	repsMax: number | null
	weightKg: number | null
	progressStepKg: number | null
	restSec: number | null
	/** The minutes of a planned cardio: only what the stepper starts from, never counted as done. */
	durationMin: number | null
	/** What the dictionary knows (the person's own choice is on the exercise itself). */
	isBodyweight: boolean | null
	lastSets: ProgramLastSet[] | null
	/** The weight to try today; «Взяти» puts it into the sets still to do. */
	progressHintKg: number | null
}

export interface LiveDraftExercise {
	/** Key of the row in a list: the `clientKey` of a live exercise, the server id of a chat one. */
	rowKey: string
	/** Sent to the server; null only for a chat exercise (read only, never sent). */
	clientKey: string | null
	/** The chat wrote it (no `clientKey`): shown, never edited, never in the PUT. An exercise the chat rewrote keeps its key and is not read only. */
	readOnly: boolean
	exerciseId: string | null
	templateExerciseId: string | null
	name: string
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
	/** What the person set (null = not set); sent as it is. */
	isBodyweight: boolean | null
	durationMin: number | null
	distanceM: number | null
	sets: LiveDraftSet[]
	plan: LiveDraftPlan | null
}

export interface LiveDraft {
	workoutId: string
	templateName: string | null
	/** ISO; null for a session the chat started without a time. */
	startedAt: string | null
	exercises: LiveDraftExercise[]
}
