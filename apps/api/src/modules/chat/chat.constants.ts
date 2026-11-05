import { minutes } from '@nestjs/throttler'
import { WORKOUT_APPEND_MAX_GAP_HOURS } from '@kus/shared'

/** Per IP; the daily AI limit per user is separate (AiUsageService). */
export const SEND_MESSAGE_THROTTLE = { default: { limit: 20, ttl: minutes(1) } }

/** A PENDING message older than this was lost (crash, deploy) and may be processed again. */
export const STALE_PENDING_MS = minutes(2)

/** The AI reads one image per message until B1 (several images in one request); then raise this. */
export const SUPPORTED_PHOTOS_PER_MESSAGE = 1

/** Yesterday's entries read for «як вчора»: the model sees the first EARLIER_YESTERDAY_MAX_ENTRIES. */
export const EARLIER_YESTERDAY_FETCH_ENTRIES = 50

/** Newest entries of the last month scanned for the food a message names; the name match narrows them. */
export const EARLIER_RECENT_SCAN_MAX_ENTRIES = 400

/** Kusik's reply when a proposed program is exactly the active one (no card). */
export const PROGRAM_UNCHANGED_REPLY = 'Це вже так у програмі.'

/** Kusik's message with a card recounted against the current program («Перерахувати»). */
export const PROGRAM_REBASED_REPLY = 'Перерахував від поточної програми.'

/** Kusik's reply, no card: the program changed in the editor after the model read it. */
export const PROGRAM_BASE_CHANGED_REPLY =
	'Програму щойно змінено в редакторі — напиши ще раз, що змінити.'

/** Kusik's reply under a stats card when the second model call (advice) did not come back. */
export const STATS_ADVICE_FAILED_REPLY =
	'Поради зараз не вийшли — напиши «дай поради», і я спробую ще раз.'

const DECIMAL = 10
const HUNDRED = 100

/** «година» / «години» / «годин» for a whole number of hours (1, 21 / 2–4, 22–24 / 5–20, 25…). */
export const getHoursWord = (hours: number): string => {
	const lastTwo = Math.abs(hours) % HUNDRED
	const last = lastTwo % DECIMAL
	const isTeen = lastTwo >= 11 && lastTwo <= 14
	if (last === 1 && !isTeen) return 'година'
	if (last >= 2 && last <= 4 && !isTeen) return 'години'
	return 'годин'
}

/**
 * The auto-close sentence for the gap of WORKOUT_APPEND_MAX_GAP_HOURS, grammatical for any value;
 * for 3 it is exactly the approved «… минуло понад 3 години.».
 */
export const buildAutoClosedText = (hours: number): string =>
	`Закрив {{name}} — після останнього підходу минуло понад ${hours} ${getHoursWord(hours)}.`

/**
 * Kusik's message over the summary card of a session finished by the live mode, the form or the
 * auto-close (approved verbatim; no «спалив», «заробив», «дефіцит», «доїж», «можна з'їсти ще»).
 * The record sentence follows the first one after a space.
 */
export const WORKOUT_SUMMARY_TEXT = {
	named: 'Записав {{name}}.',
	unnamed: 'Записав тренування.',
	oneRecord: 'Рекорд — {{exercise}}.',
	manyRecords: 'Нових рекордів: {{count}}.',
	autoClosed: buildAutoClosedText(WORKOUT_APPEND_MAX_GAP_HOURS),
	/** {{name}} of the auto-closed sentence for a session without a template. */
	autoClosedUnnamed: 'тренування',
} as const
