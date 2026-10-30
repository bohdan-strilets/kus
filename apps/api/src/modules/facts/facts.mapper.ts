import type { FactResponse } from '@kus/shared'

import type { UserFact } from '../../generated/prisma/client'

export const toFactResponse = (fact: UserFact): FactResponse => ({
	id: fact.id,
	text: fact.text,
	category: fact.category,
	status: fact.status,
	createdAt: fact.createdAt.toISOString(),
})
