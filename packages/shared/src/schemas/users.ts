import { z } from 'zod'

import { addressFormSchema } from './enums.js'

export const ADDRESS_AS_MAX_LENGTH = 30

/**
 * Body of PATCH /users/me: the fields to change, at least one. An empty «Як до тебе звертатися?»
 * clears `addressAs` (back to the name); `addressForm` picks the gender forms of the words about the user.
 */
export const updateMeRequestSchema = z
	.object({
		addressAs: z
			.string()
			.trim()
			.max(ADDRESS_AS_MAX_LENGTH)
			.nullable()
			.transform((value) => (value === '' ? null : value))
			.optional(),
		addressForm: addressFormSchema.optional(),
	})
	.refine((body) => body.addressAs !== undefined || body.addressForm !== undefined)

export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>
