import { httpClient } from '@/shared/api'

/** Soft delete (204): the chat can bring the training back in words. */
export const deleteWorkout = async (id: string): Promise<void> => {
	await httpClient.delete(`/workouts/${id}`)
}
