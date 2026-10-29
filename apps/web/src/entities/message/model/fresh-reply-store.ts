import type { ChatMessage } from '@kus/shared'
import { create } from 'zustand'

/** A card stays «just logged» this long after its reply arrived; a later visit to the chat shows none. */
export const FRESH_TTL_MS = 10_000

/** Keys of the things a reply brings: ids alone would collide across tables. */
export const freshKey = {
	meal: (id: string): string => `meal:${id}`,
	measurement: (id: string): string => `measurement:${id}`,
	achievement: (id: string): string => `achievement:${id}`,
	workout: (id: string): string => `workout:${id}`,
} as const

const getFreshKeys = (message: ChatMessage): string[] => [
	...message.meals.map((meal) => freshKey.meal(meal.id)),
	...message.measurements.map((measurement) => freshKey.measurement(measurement.id)),
	...message.achievements.map((achievement) => freshKey.achievement(achievement.id)),
	...message.workouts.map((workout) => freshKey.workout(workout.id)),
]

interface FreshReplyState {
	/** The signed-in user (null after logout); a different one drops the marks of the previous. */
	ownerId: string | null
	/** When (ms) the reply with each card (see `freshKey`) arrived in this session: the card plays its «just logged» effect once. */
	freshAt: Readonly<Record<string, number>>
	claim: (userId: string | null) => void
	markFresh: (message: ChatMessage, now?: number) => void
	isFresh: (key: string, now?: number) => boolean
	release: (key: string) => void
}

export const useFreshReplyStore = create<FreshReplyState>()((set, get) => ({
	ownerId: null,
	freshAt: {},
	claim: (userId) => {
		set((state) => (state.ownerId === userId ? state : { ownerId: userId, freshAt: {} }))
	},
	markFresh: (message, now = Date.now()) => {
		const keys = getFreshKeys(message)
		if (keys.length === 0) return
		set((state) => {
			// expired marks go on every write, so the store does not grow over a long session
			const alive = Object.entries(state.freshAt).filter(([, at]) => now - at < FRESH_TTL_MS)
			return {
				freshAt: {
					...Object.fromEntries(alive),
					...Object.fromEntries(keys.map((key) => [key, now])),
				},
			}
		})
	},
	isFresh: (key, now = Date.now()) => {
		const at = get().freshAt[key]
		return at !== undefined && now - at < FRESH_TTL_MS
	},
	release: (key) => {
		set((state) => {
			if (!(key in state.freshAt)) return state
			const { [key]: _released, ...rest } = state.freshAt
			return { freshAt: rest }
		})
	},
}))
