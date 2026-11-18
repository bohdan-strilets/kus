import { httpClient } from '@/shared/api'

export const restoreRecipe = async (id: string): Promise<void> => {
	await httpClient.post(`/recipes/${id}/restore`)
}
