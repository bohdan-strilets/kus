import { WorkoutTurnInconsistentException } from './workouts.exceptions'

/** Ref → id of what the model saw in this request; nothing else can be changed (IDOR). */
export interface WorkoutRefIds {
	workouts: ReadonlyMap<string, string>
	deletedWorkouts: ReadonlyMap<string, string>
	exercises: ReadonlyMap<string, string>
}

export const NO_WORKOUT_REFS: WorkoutRefIds = {
	workouts: new Map(),
	deletedWorkouts: new Map(),
	exercises: new Map(),
}

/** Refs were checked against this same map by the parser; a miss is a bug, not user input. */
export const toId = (refIds: ReadonlyMap<string, string>, ref: string): string => {
	const id = refIds.get(ref)
	if (id === undefined) throw new WorkoutTurnInconsistentException()
	return id
}
