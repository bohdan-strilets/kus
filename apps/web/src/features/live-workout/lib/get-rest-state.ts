const MS_IN_SECOND = 1000

/** «+15 с» of the rest timer. */
export const REST_EXTEND_SEC = 15

export type RestState =
	| { status: 'idle' }
	| { status: 'running'; remainingSec: number; totalSec: number }
	| { status: 'ended'; totalSec: number; overdueMs: number }

export interface RestStateInput {
	/** ISO `doneAt` of the set done last; null = no set is done yet. */
	lastDoneAt: string | null
	/** The rest the plan of that exercise asks (or the default). */
	restSec: number
	/** What «+15 с» added to this rest. */
	extraSec: number
	/** «Пропустити» / «До підходу» was pressed for this very `doneAt`. */
	isSkipped: boolean
	/** A set is still waiting after the done one: after the last set of the last exercise no rest is shown. */
	hasNextSet: boolean
	nowMs: number
}

/**
 * The rest after a set, counted from the real `doneAt` (not from ticks: iOS freezes the page in
 * the background). Running while time is left, ended after it — however long ago it ended.
 */
export const getRestState = (input: RestStateInput): RestState => {
	const { lastDoneAt, restSec, extraSec, isSkipped, hasNextSet, nowMs } = input
	if (lastDoneAt === null || isSkipped || !hasNextSet) return { status: 'idle' }
	const doneMs = new Date(lastDoneAt).getTime()
	if (Number.isNaN(doneMs)) return { status: 'idle' }

	const totalSec = restSec + extraSec
	const leftMs = doneMs + totalSec * MS_IN_SECOND - nowMs
	if (leftMs <= 0) return { status: 'ended', totalSec, overdueMs: -leftMs }
	// a clock a bit behind the device that wrote `doneAt` must not show more than the whole rest
	const remainingSec = Math.min(totalSec, Math.ceil(leftMs / MS_IN_SECOND))
	return { status: 'running', remainingSec, totalSec }
}
