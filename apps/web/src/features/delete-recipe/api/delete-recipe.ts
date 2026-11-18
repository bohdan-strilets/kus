import { httpClient } from '@/shared/api'

/** Soft delete: «Скасувати» in the toast brings it back. */
export const deleteRecipe = async (id: string): Promise<void> => {
	await httpClient.delete(`/recipes/${id}`)
}
