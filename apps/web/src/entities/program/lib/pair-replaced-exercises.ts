import type { ProgramChangeLine } from '@kus/shared'

export interface IndexedChangeLine {
	line: ProgramChangeLine
	/** The place of the line in the stored card: the key of its row. */
	index: number
}

const isExerciseLine = (item: IndexedChangeLine, op: ProgramChangeLine['op']): boolean =>
	item.line.scope === 'EXERCISE' && item.line.op === op

/**
 * A replaced exercise is a REMOVE and an ADD of the same template, far apart in the stored card.
 * The i-th removed one goes with the i-th added one of its template, the added one right after it;
 * the unpaired ones stay where they were.
 */
export const pairReplacedExercises = (items: IndexedChangeLine[]): IndexedChangeLine[] => {
	const addedByTemplate = new Map<string, IndexedChangeLine[]>()
	for (const item of items.filter((candidate) => isExerciseLine(candidate, 'ADD'))) {
		const key = item.line.templateName ?? ''
		addedByTemplate.set(key, [...(addedByTemplate.get(key) ?? []), item])
	}

	const partnerOf = new Map<IndexedChangeLine, IndexedChangeLine>()
	const removedCount = new Map<string, number>()
	for (const item of items.filter((candidate) => isExerciseLine(candidate, 'REMOVE'))) {
		const key = item.line.templateName ?? ''
		const position = removedCount.get(key) ?? 0
		removedCount.set(key, position + 1)
		const partner = addedByTemplate.get(key)?.[position]
		if (partner) partnerOf.set(item, partner)
	}

	const paired = new Set(partnerOf.values())
	return items.flatMap((item) => {
		if (paired.has(item)) return []
		const partner = partnerOf.get(item)
		return partner ? [item, partner] : [item]
	})
}
