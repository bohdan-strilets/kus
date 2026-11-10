// When a new service worker is waiting, the open tab still runs the old version (and F5 first
// serves it from the old precache). The new one is applied silently, but only at a moment that
// costs the user nothing: nothing is being sent and nothing is being typed.

/** A second apply this soon after the last one means the update does not take: no reload loop. */
const APPLY_COOLDOWN_MS = 60_000

export type UpdateTrigger = 'need-refresh' | 'visibility-change'

export interface UpdateMoment {
	trigger: UpdateTrigger
	visibilityState: DocumentVisibilityState
	/** A message of the outbox is on its way (a reload would cut the request). */
	isSending: boolean
	/** The composer holds words or a picture that has not been sent. */
	hasDraft: boolean
	/** A live workout is open (or has sets the server has not confirmed): a reload would break it. */
	hasLiveWorkout: boolean
	/** `Date.now()` of the last apply in this session, null when there was none. */
	lastApplyAt: number | null
	now: number
}

/**
 * The tab is out of sight, or has just been brought back from the background: the reload is not
 * a surprise in the middle of the user's action. A «need refresh» while the tab is in front waits.
 */
export const isQuietTrigger = (
	trigger: UpdateTrigger,
	visibilityState: DocumentVisibilityState,
): boolean => trigger === 'visibility-change' || visibilityState === 'hidden'

export const shouldApplyUpdate = ({
	trigger,
	visibilityState,
	isSending,
	hasDraft,
	hasLiveWorkout,
	lastApplyAt,
	now,
}: UpdateMoment): boolean => {
	if (!isQuietTrigger(trigger, visibilityState)) return false
	if (isSending || hasDraft || hasLiveWorkout) return false
	return lastApplyAt === null || now - lastApplyAt > APPLY_COOLDOWN_MS
}
