import { z } from 'zod'

export const ADDRESS_AS_MAX_LENGTH = 30

/** Body of PATCH /users/me. An empty «Як до тебе звертатися?» clears it (back to the name). */
export const updateMeRequestSchema = z.object({
	addressAs: z
		.string()
		.trim()
		.max(ADDRESS_AS_MAX_LENGTH)
		.nullable()
		.transform((value) => (value === '' ? null : value)),
})

export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>
