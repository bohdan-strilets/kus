import { httpClient } from '@/shared/api'

/** Soft delete: the chat can still bring the entry back in words. */
export const deleteFoodEntry = async (id: string): Promise<void> => {
	await httpClient.delete(`/food-entries/${id}`)
}
