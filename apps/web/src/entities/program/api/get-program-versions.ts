import {
	createDataResponseSchema,
	type ProgramVersionListResponse,
	programVersionListResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(programVersionListResponseSchema)

/** The versions of the active program, newest first, with what each one changed. */
export const getProgramVersions = async (): Promise<ProgramVersionListResponse> => {
	const response = await httpClient.get<unknown>('/programs/active/versions')
	return responseSchema.parse(response.data).data
}
