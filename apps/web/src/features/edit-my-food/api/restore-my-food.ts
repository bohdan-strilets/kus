import { httpClient } from '@/shared/api'

export const restoreMyFood = async (id: string): Promise<void> => {
	await httpClient.post(`/my-foods/${id}/restore`)
}
