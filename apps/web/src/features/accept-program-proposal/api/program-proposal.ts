import {
	createDataResponseSchema,
	type ProgramResponse,
	programResponseSchema,
	type RebaseProgramProposalResponse,
	rebaseProgramProposalResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const programSchema = createDataResponseSchema(programResponseSchema)
const rebaseSchema = createDataResponseSchema(rebaseProgramProposalResponseSchema)

/** «Прийняти»: the card becomes the new version of the active program. */
export const acceptProgramProposal = async (messageId: string): Promise<ProgramResponse> => {
	const response = await httpClient.post<unknown>(`/programs/proposals/${messageId}/accept`)
	return programSchema.parse(response.data).data
}

/** «Перерахувати»: the card of a stale base is made again on the current program. */
export const rebaseProgramProposal = async (
	messageId: string,
): Promise<RebaseProgramProposalResponse> => {
	const response = await httpClient.post<unknown>(`/programs/proposals/${messageId}/rebase`)
	return rebaseSchema.parse(response.data).data
}
