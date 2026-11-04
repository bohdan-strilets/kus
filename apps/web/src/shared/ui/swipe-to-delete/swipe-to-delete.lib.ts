import {
	SWIPE_AXIS_RATIO,
	SWIPE_COMMIT_RATIO,
	SWIPE_OPEN_MIN_PX,
	SWIPE_START_PX,
} from './swipe-to-delete.constants'
import type { SwipeOutcome } from './swipe-to-delete.types'

/** design/docs/motion.md «Живий режим» п. 4: a horizontal gesture starts at |dx| > 10 and |dx| > 1,5·|dy|. */
export const isHorizontalSwipe = (dx: number, dy: number): boolean =>
	Math.abs(dx) > SWIPE_START_PX && Math.abs(dx) > SWIPE_AXIS_RATIO * Math.abs(dy)

/**
 * What a release does. `dx` is the row's shift (negative = to the left, the only direction that
 * counts): < 72 px — back, 72 px … 50 % of `width` — the action stays open, more — it runs.
 */
export const getSwipeOutcome = (dx: number, width: number): SwipeOutcome => {
	const distance = -dx
	if (distance > width * SWIPE_COMMIT_RATIO) return 'commit'
	if (distance >= SWIPE_OPEN_MIN_PX) return 'open'
	return 'close'
}
