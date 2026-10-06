import { useState } from 'react'

/** A key that changes on every replay: remounting a motion element restarts its animation. */
export const useReplay = (): [number, () => void] => {
	const [replayKey, setReplayKey] = useState(0)
	const replay = (): void => {
		setReplayKey((key) => key + 1)
	}
	return [replayKey, replay]
}
