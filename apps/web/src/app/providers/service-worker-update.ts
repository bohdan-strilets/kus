// When a new service worker is waiting, the open tab still runs the old version (and F5 first
// serves it from the old precache). The new one is applied silently, but only at a moment that
// costs the user nothing: nothing is being sent and nothing is being typed.

/** A second apply this soon after the last one means the update does not take: no reload loop. */
const APPLY_COOLDOWN_MS = 60_000

/** A tab that has just come back and has not been touched yet: a reload there is not a surprise. */
export const RETURN_WINDOW_MS = 10_000

export type UpdateTrigger = 'need-refresh' | 'visibility-change'

export interface UpdateMoment {
	trigger: UpdateTrigger
	visibilityState: DocumentVisibilityState
	/** `Date.now()` when the tab last became visible (or the app started visible), null while hidden. */
	lastVisibleAt: number | null
	/** A tap or a key since the tab became visible. */
	hasInteractedSinceVisible: boolean
	/** The cursor is in a text field: the user is about to type or is typing. */
	hasFocusedField: boolean
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
 * The tab is out of sight, was just brought back, or is a cold start that has not been touched:
 * the reload is not a surprise in the middle of the user's action. A «need refresh» while the tab
 * has been in front and in use waits.
 */
export const isQuietMoment = ({
	trigger,
	visibilityState,
	lastVisibleAt,
	hasInteractedSinceVisible,
	now,
}: Pick<
	UpdateMoment,
	'trigger' | 'visibilityState' | 'lastVisibleAt' | 'hasInteractedSinceVisible' | 'now'
>): boolean => {
	if (trigger === 'visibility-change' || visibilityState === 'hidden') return true
	// what is left is a «need refresh» in a visible tab
	return (
		lastVisibleAt !== null && now - lastVisibleAt <= RETURN_WINDOW_MS && !hasInteractedSinceVisible
	)
}

export const shouldApplyUpdate = (moment: UpdateMoment): boolean => {
	if (!isQuietMoment(moment)) return false
	if (moment.hasFocusedField) return false
	if (moment.isSending || moment.hasDraft || moment.hasLiveWorkout) return false
	return moment.lastApplyAt === null || moment.now - moment.lastApplyAt > APPLY_COOLDOWN_MS
}
