import { ENTRY_BACKDATE_MAX_DAYS } from '@kus/shared'

import { getDayRelation, shiftLocalDate } from '@/shared/lib'

/** today — the first entry is still to come; tomorrow — nothing planned; recent — a day food can still be added to; old — past that. */
export type EmptyDayKind = 'today' | 'tomorrow' | 'recent' | 'old'

/** Which empty state a day without food gets (design/docs/screens.md → «Сьогодні», 0.6.2). */
export const getEmptyKind = (localDate: string, today: string): EmptyDayKind => {
	const relation = getDayRelation(localDate, today)
	if (relation === 'today' || relation === 'tomorrow') return relation
	return localDate >= shiftLocalDate(today, -ENTRY_BACKDATE_MAX_DAYS) ? 'recent' : 'old'
}
