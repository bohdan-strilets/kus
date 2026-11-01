import { httpClient } from '@/shared/api'

/** Soft delete (204): the program and its versions go; the trainings done by it stay. */
export const removeProgram = async (): Promise<void> => {
	await httpClient.delete('/programs/active')
}
