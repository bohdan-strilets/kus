import { httpClient } from '@/shared/api'

/** Soft delete: «Повернути» in the toast brings it back. */
export const deleteMeasurement = async (id: string): Promise<void> => {
	await httpClient.delete(`/measurements/${id}`)
}
