const FLAG_PREFIX = 'kusik-goal-celebrated:'
const FLAG_VALUE = '1'

const getUserPrefix = (userId: string): string => `${FLAG_PREFIX}${userId}:`

const getFlagKey = (userId: string, localDate: string): string =>
	`${getUserPrefix(userId)}${localDate}`

/** Collected first: removing while iterating shifts the indexes. */
const listUserKeys = (userId: string): string[] => {
	const prefix = getUserPrefix(userId)
	const keys: string[] = []
	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index)
		if (key?.startsWith(prefix)) keys.push(key)
	}
	return keys
}

/**
 * Only a flag, never a value: what the user ate must not sit in the storage. The celebration is
 * decoration, so an unavailable storage (private mode, quota) deliberately breaks nothing.
 */
export const hasCelebratedGoal = (userId: string, localDate: string): boolean => {
	try {
		return localStorage.getItem(getFlagKey(userId, localDate)) !== null
	} catch {
		return false
	}
}

/** Writes the day's flag and drops the user's flags of other dates, so the storage does not grow. */
export const markGoalCelebrated = (userId: string, localDate: string): void => {
	try {
		const key = getFlagKey(userId, localDate)
		for (const stale of listUserKeys(userId)) {
			if (stale !== key) localStorage.removeItem(stale)
		}
		localStorage.setItem(key, FLAG_VALUE)
	} catch {
		// decoration only: an unavailable storage means at worst a repeated celebration
	}
}

/** A different user on the device must not inherit the previous one's data (RODO). */
export const clearGoalCelebratedFlags = (userId: string): void => {
	try {
		for (const key of listUserKeys(userId)) localStorage.removeItem(key)
	} catch {
		// decoration only: nothing to clean when the storage is unavailable
	}
}
