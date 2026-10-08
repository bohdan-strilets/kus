import { createDataResponseSchema, type DayInRange, dayInRangeSchema } from '@kus/shared'
import { z } from 'zod'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(z.array(dayInRangeSchema))

/** Each day of [from, to] against the goal in force that day — the week strip. */
export const getDays = async ({
	from,
	to,
}: {
	from: string
	to: string
}): Promise<DayInRange[]> => {
	const response = await httpClient.get<unknown>('/days', { params: { from, to } })
	return responseSchema.parse(response.data).data
}
