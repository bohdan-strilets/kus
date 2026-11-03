export interface SetDoneEvent {
	workoutId: string
	/** `clientKey` of the exercise. */
	exerciseKey: string
	setIndex: number
	/** The rest the plan asks after the set; null when it names none. */
	restSec: number | null
}

export type SetDoneListener = (event: SetDoneEvent) => void

const listeners = new Set<SetDoneListener>()

/** The one hook point for «підхід виконано»: 0.10.4 attaches the rest timer here. Returns the unsubscribe. */
export const onSetDone = (listener: SetDoneListener): (() => void) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

/** The live screen calls it once, when the person marks a set done. */
export const notifySetDone = (event: SetDoneEvent): void => {
	listeners.forEach((listener) => {
		listener(event)
	})
}
