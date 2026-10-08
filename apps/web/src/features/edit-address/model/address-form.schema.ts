import { ADDRESS_AS_MAX_LENGTH } from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

/** The API limit with a message to act on; empty is fine — it means «by the name». */
export const createAddressSchema = (t: TFunction) =>
	z.object({
		addressAs: z
			.string()
			.trim()
			.max(ADDRESS_AS_MAX_LENGTH, t('profile.address.tooLong', { max: ADDRESS_AS_MAX_LENGTH })),
	})

export type AddressFormValues = z.infer<ReturnType<typeof createAddressSchema>>
