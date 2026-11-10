import { formatDbDate } from '../../common/time'
import type { HistoryCorrectionRow } from './entries.repository'

export type HistoryCorrectionKind = 'deleted' | 'restored' | 'edited'

/** A Correction as the chat history reads it: what happened to which entry, and by whom. */
export interface HistoryCorrection {
	entryId: string
	/** The user message of the chat turn that did it; null = the app (or a row from before the field). */
	messageId: string | null
	createdAt: Date
	kind: HistoryCorrectionKind
	/** The weight an edit left the entry with. */
	grams: number | null
	name: string
	/** The entry's day, `YYYY-MM-DD`. */
	localDate: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const toKind = (after: Record<string, unknown>): HistoryCorrectionKind => {
	if (after.deleted === true) return 'deleted'
	if (after.deleted === false) return 'restored'
	return 'edited'
}

export const toHistoryCorrection = (row: HistoryCorrectionRow): HistoryCorrection => {
	const after = isRecord(row.after) ? row.after : {}
	return {
		entryId: row.foodEntryId,
		messageId: row.messageId,
		createdAt: row.createdAt,
		kind: toKind(after),
		grams: typeof after.grams === 'number' ? after.grams : null,
		name: row.foodEntry.name,
		localDate: formatDbDate(row.foodEntry.meal.localDate),
	}
}
