import type {
	LiveWorkoutResponse,
	WorkoutFinished,
	WorkoutFinishResponse,
	WorkoutForm,
} from '@kus/shared'
import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query'

import { discardLiveWorkout, finishLiveWorkout, startLiveWorkout } from '../api/live-workout'
import { postWorkoutForm } from '../api/post-workout-form'
import { setLiveWorkout } from './live-workout-query'
import { WORKOUTS_QUERY_KEY } from './workout-query'

interface LiveWorkoutActions {
	/** The argument is the template id, or null for an empty session. */
	start: UseMutationResult<LiveWorkoutResponse, Error, string | null>
	finish: UseMutationResult<WorkoutFinishResponse, Error, string>
	discard: UseMutationResult<void, Error, string>
	saveForm: UseMutationResult<WorkoutFinished, Error, WorkoutForm>
}

/**
 * Start, «Завершити», «Вийти без збереження» and «Зберегти» of the form. Each leaves the workouts
 * cache right: the session opens or closes, the lists and the stats are read again. The chat feed
 * (finish and form add a summary message) and the program's «next» are the callers' to refresh.
 */
export const useLiveWorkoutActions = (): LiveWorkoutActions => {
	const queryClient = useQueryClient()
	const refreshWorkouts = (): void => {
		void queryClient.invalidateQueries({ queryKey: WORKOUTS_QUERY_KEY })
	}

	const start = useMutation({
		mutationFn: startLiveWorkout,
		onSuccess: (live) => {
			setLiveWorkout(queryClient, live)
		},
	})
	const finish = useMutation({
		mutationFn: finishLiveWorkout,
		onSuccess: () => {
			setLiveWorkout(queryClient, null)
			refreshWorkouts()
		},
		// a 409 FINISHED means the chat was first: the session is closed either way
		onError: refreshWorkouts,
	})
	const discard = useMutation({
		mutationFn: discardLiveWorkout,
		onSuccess: () => {
			setLiveWorkout(queryClient, null)
			refreshWorkouts()
		},
		onError: refreshWorkouts,
	})
	const saveForm = useMutation({
		mutationFn: postWorkoutForm,
		onSuccess: refreshWorkouts,
	})

	return { start, finish, discard, saveForm }
}
