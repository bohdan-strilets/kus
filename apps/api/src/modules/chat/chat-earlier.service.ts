import { Injectable } from '@nestjs/common'
import { EARLIER_NAMED_LOOKBACK_DAYS, hasHistoryReference, shiftDate } from '@kus/shared'

import { EntriesService } from '../entries/entries.service'
import { EARLIER_RECENT_SCAN_MAX_ENTRIES, EARLIER_YESTERDAY_FETCH_ENTRIES } from './chat.constants'
import { buildEarlierContext, type EarlierContext, NO_EARLIER_CONTEXT } from './history-context'

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

/** Earlier entries for a message that points back; any other message costs no query at all. */
@Injectable()
export class ChatEarlierService {
	constructor(private readonly entriesService: EntriesService) {}

	async getContext({
		userId,
		text,
		today,
	}: {
		userId: string
		text: string
		/** `YYYY-MM-DD` of the user's today. */
		today: string
	}): Promise<EarlierContext> {
		if (!hasHistoryReference(text)) return NO_EARLIER_CONTEXT
		const yesterday = shiftDate(today, -1)
		const [yesterdayEntries, recent] = await Promise.all([
			this.entriesService.findDayEntries(
				userId,
				toDbDate(yesterday),
				EARLIER_YESTERDAY_FETCH_ENTRIES,
			),
			this.entriesService.findRecentEntries(
				userId,
				{ from: toDbDate(shiftDate(today, -EARLIER_NAMED_LOOKBACK_DAYS)), to: toDbDate(yesterday) },
				EARLIER_RECENT_SCAN_MAX_ENTRIES,
			),
		])
		return buildEarlierContext({ text, yesterday: yesterdayEntries, recent })
	}
}
