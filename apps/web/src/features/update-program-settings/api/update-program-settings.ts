import {
	createDataResponseSchema,
	type ProgramResponse,
	programResponseSchema,
	type UpdateProgramSettingsRequest,
	type UpdateTemplateScheduleRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(programResponseSchema)

/** Mode, the pinned template and «разів на тиждень»; only the sent fields change. */
export const updateProgramSettings = async (
	body: UpdateProgramSettingsRequest,
): Promise<ProgramResponse> => {
	const response = await httpClient.patch<unknown>('/programs/active', body)
	return responseSchema.parse(response.data).data
}

/** The weekdays of one template. */
export const updateTemplateWeekdays = async ({
	templateId,
	weekdays,
}: UpdateTemplateScheduleRequest & { templateId: string }): Promise<ProgramResponse> => {
	const response = await httpClient.patch<unknown>(`/programs/active/templates/${templateId}`, {
		weekdays,
	})
	return responseSchema.parse(response.data).data
}
