import { createDataResponseSchema, type ProgramResponse, programResponseSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(programResponseSchema.nullable())

/** The user's active program; null while they have none. */
export const getActiveProgram = async (): Promise<ProgramResponse | null> => {
	const response = await httpClient.get<unknown>('/programs/active')
	return responseSchema.parse(response.data).data
}
