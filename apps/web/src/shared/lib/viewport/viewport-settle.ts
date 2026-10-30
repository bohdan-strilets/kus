/** Frames in a row with an unchanged box (~130 ms) before the viewport counts as settled. */
export const VIEWPORT_SETTLE_STABLE_FRAMES = 8
/** Never stop earlier than this after a trigger: iOS may still report the old value. */
export const VIEWPORT_SETTLE_MIN_MS = 300
/** Never poll longer than this after a trigger. */
export const VIEWPORT_SETTLE_MAX_MS = 1500

export interface SettleProgress {
	startedAt: number
	stableFrames: number
}

export interface SettleStep {
	progress: SettleProgress
	isDone: boolean
}

export const startSettle = (now: number): SettleProgress => ({ startedAt: now, stableFrames: 0 })

/** One animation frame of the settle loop: counts unchanged frames and decides whether to stop. */
export const advanceSettle = (
	progress: SettleProgress,
	{ now, hasChanged }: { now: number; hasChanged: boolean },
): SettleStep => {
	const next: SettleProgress = {
		startedAt: progress.startedAt,
		stableFrames: hasChanged ? 0 : progress.stableFrames + 1,
	}
	const elapsed = now - progress.startedAt
	const isStable =
		next.stableFrames >= VIEWPORT_SETTLE_STABLE_FRAMES && elapsed >= VIEWPORT_SETTLE_MIN_MS
	return { progress: next, isDone: isStable || elapsed >= VIEWPORT_SETTLE_MAX_MS }
}
