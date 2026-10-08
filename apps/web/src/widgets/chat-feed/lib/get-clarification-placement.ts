import type { ChatMessage } from '@kus/shared'

export interface ClarificationPlacement {
	/** The question opens under this entry — the last one it asks about, in the day's order. */
	lastEntryId: string | undefined
	/** What was logged for its entries; the «суха?» hint compares the answers with it. */
	loggedKcal: number
}

/** Over every meal of the reply: a whole day may ask about entries of different meals. */
export const getClarificationPlacement = ({
	meals,
	clarifications,
}: Pick<ChatMessage, 'meals' | 'clarifications'>): ReadonlyMap<string, ClarificationPlacement> => {
	const entries = meals.flatMap((meal) => meal.entries)
	return new Map(
		clarifications.map((clarification) => {
			const linked = entries.filter((entry) => clarification.entryIds.includes(entry.id))
			return [
				clarification.id,
				{
					lastEntryId: linked.at(-1)?.id,
					loggedKcal: linked.reduce((sum, entry) => sum + entry.kcal, 0),
				},
			]
		}),
	)
}
