import { create } from 'zustand'

import {
	clearGoalCelebratedFlags,
	hasCelebratedGoal,
	markGoalCelebrated,
} from '../lib/goal-celebrated-flag'

/** A local action arms the detector for this long: a refetch that lands later is not «ours». */
export const GOAL_ARM_WINDOW_MS = 30_000
/** A detected goal is celebrated only while it is fresh; a late one is dropped, never replayed. */
export const GOAL_PENDING_TTL_MS = 3_000

interface Armed {
	at: number
	messageId: string | null
}

interface PendingGoal {
	localDate: string
	messageId: string | null
	detectedAt: number
}

export interface GoalCelebration {
	localDate: string
	messageId: string | null
}

interface ConsumeParams {
	userId: string
	today: string
	now?: number
}

interface GoalCelebrationState {
	/** The signed-in user (null after logout); a different one drops everything of the previous. */
	ownerId: string | null
	armed: Armed | null
	pending: PendingGoal | null
	/** The reply whose card caused the celebration (null for an edit). */
	celebratedReplyId: string | null
	claim: (userId: string | null) => void
	arm: (messageId: string | null, now?: number) => void
	isArmed: (now?: number) => boolean
	setPending: (localDate: string, now?: number) => void
	consume: (params: ConsumeParams) => GoalCelebration | null
}

export const useGoalCelebrationStore = create<GoalCelebrationState>()((set, get) => ({
	ownerId: null,
	armed: null,
	pending: null,
	celebratedReplyId: null,
	claim: (userId) => {
		const { ownerId } = get()
		if (ownerId === userId) return
		// null before: the first user is known after a page load, and their flag must survive it
		if (ownerId !== null) clearGoalCelebratedFlags(ownerId)
		set({ ownerId: userId, armed: null, pending: null, celebratedReplyId: null })
	},
	arm: (messageId, now = Date.now()) => {
		set({ armed: { at: now, messageId } })
	},
	isArmed: (now = Date.now()) => {
		const { armed } = get()
		return armed !== null && now - armed.at < GOAL_ARM_WINDOW_MS
	},
	setPending: (localDate, now = Date.now()) => {
		// one arming explains one detection
		set((state) => ({
			pending: { localDate, messageId: state.armed?.messageId ?? null, detectedAt: now },
			armed: null,
		}))
	},
	consume: ({ userId, today, now = Date.now() }) => {
		const { pending } = get()
		if (pending === null) return null
		const { localDate, messageId, detectedAt } = pending
		if (now - detectedAt > GOAL_PENDING_TTL_MS || localDate !== today) {
			set({ pending: null })
			return null
		}
		if (hasCelebratedGoal(userId, localDate)) {
			set({ pending: null })
			return null
		}
		markGoalCelebrated(userId, localDate)
		set({ pending: null, celebratedReplyId: messageId })
		return { localDate, messageId }
	},
}))
