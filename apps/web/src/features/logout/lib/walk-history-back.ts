/** What the walk uses of the browser: `window` in the app, a fake in tests. */
export interface HistoryWalkEnv {
	go: (delta: number) => void
	onPopState: (listener: () => void) => () => void
	setTimer: (callback: () => void, ms: number) => () => void
}

interface WalkOptions {
	/** Entries to go back (>0). */
	steps: number
	/** Once, when the walk has landed — or when it never came. */
	onArrive: () => void
	timeoutMs: number
}

/**
 * history.go is async and reports only through popstate. The walk ends once: on the first
 * popstate, or on the timer when no popstate came (nothing to go back to, a blocked traversal).
 */
export const walkHistoryBack = (
	{ steps, onArrive, timeoutMs }: WalkOptions,
	env: HistoryWalkEnv,
): void => {
	let isDone = false
	const cleanups: (() => void)[] = []
	const arrive = (): void => {
		if (isDone) return
		isDone = true
		for (const cleanup of cleanups) cleanup()
		onArrive()
	}
	cleanups.push(env.onPopState(arrive), env.setTimer(arrive, timeoutMs))
	env.go(-steps)
}

export const browserHistoryEnv: HistoryWalkEnv = {
	go: (delta) => {
		window.history.go(delta)
	},
	onPopState: (listener) => {
		window.addEventListener('popstate', listener)
		return () => {
			window.removeEventListener('popstate', listener)
		}
	},
	setTimer: (callback, ms) => {
		const timer = setTimeout(callback, ms)
		return () => {
			clearTimeout(timer)
		}
	},
}
