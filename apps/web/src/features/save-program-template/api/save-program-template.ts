import {
	createDataResponseSchema,
	type ProgramResponse,
	programResponseSchema,
	type SaveTemplateRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(programResponseSchema)

/** «Готово» of the editor: a new version of the program with this template's exercises replaced. */
export const saveProgramTemplate = async (body: SaveTemplateRequest): Promise<ProgramResponse> => {
	const response = await httpClient.post<unknown>('/programs/active/versions', body)
	return responseSchema.parse(response.data).data
}
