import {
	createDataResponseSchema,
	type LiveWorkoutResponse,
	liveWorkoutResponseSchema,
	type LiveWorkoutUpdate,
	type WorkoutFinishResponse,
	workoutFinishResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

import { toLiveConflictError } from './live-conflict-error'

const currentResponseSchema = createDataResponseSchema(liveWorkoutResponseSchema.nullable())
const liveResponseSchema = createDataResponseSchema(liveWorkoutResponseSchema)
const finishResponseSchema = createDataResponseSchema(workoutFinishResponseSchema)

const LIVE_WORKOUTS_PATH = '/live-workouts'
/** Shorter than the default: on a lie-fi connection the save must turn into «offline» fast. */
const LIVE_PUT_TIMEOUT_MS = 10_000

/** The open live session of the user; null when none (a stale one is closed by the server first). */
export const getLiveWorkout = async (): Promise<LiveWorkoutResponse | null> => {
	const response = await httpClient.get<unknown>(`${LIVE_WORKOUTS_PATH}/current`)
	return currentResponseSchema.parse(response.data).data
}

/** A session by a template, or an empty one (null); an open one is returned as it is. */
export const startLiveWorkout = async (templateId: string | null): Promise<LiveWorkoutResponse> => {
	const response = await httpClient.post<unknown>(LIVE_WORKOUTS_PATH, { templateId })
	return liveResponseSchema.parse(response.data).data
}

/** The whole live part of the session. Throws `LiveWorkoutConflictError` on a 409. */
export const putLiveWorkout = async ({
	workoutId,
	update,
}: {
	workoutId: string
	update: LiveWorkoutUpdate
}): Promise<LiveWorkoutResponse> => {
	try {
		const response = await httpClient.put<unknown>(`${LIVE_WORKOUTS_PATH}/${workoutId}`, update, {
			timeout: LIVE_PUT_TIMEOUT_MS,
		})
		return liveResponseSchema.parse(response.data).data
	} catch (error) {
		throw toLiveConflictError(error)
	}
}

/** «Завершити»: the summary, or `{ discarded: true }` when no set was done. */
export const finishLiveWorkout = async (workoutId: string): Promise<WorkoutFinishResponse> => {
	try {
		const response = await httpClient.post<unknown>(`${LIVE_WORKOUTS_PATH}/${workoutId}/finish`)
		return finishResponseSchema.parse(response.data).data
	} catch (error) {
		throw toLiveConflictError(error)
	}
}

/** «Вийти без збереження». */
export const discardLiveWorkout = async (workoutId: string): Promise<void> => {
	try {
		await httpClient.delete(`${LIVE_WORKOUTS_PATH}/${workoutId}`)
	} catch (error) {
		throw toLiveConflictError(error)
	}
}
