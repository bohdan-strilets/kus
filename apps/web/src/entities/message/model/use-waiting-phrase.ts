import { useEffect, useState } from 'react'

import {
	getWaitingPhraseKey,
	WAITING_PHRASE_STEP_MS,
	type WaitingPhraseKey,
} from '../lib/get-waiting-phrase-key'

/** Re-reads the phrase a few times per step, so a change lands close to its moment. */
const TICK_MS = WAITING_PHRASE_STEP_MS / 5

/** The phrase for how long Kusik has been thinking, counted from when the indicator appeared. */
export const useWaitingPhrase = (): WaitingPhraseKey => {
	const [startedAt] = useState(() => Date.now())
	const [key, setKey] = useState<WaitingPhraseKey>(() => getWaitingPhraseKey(0))

	useEffect(() => {
		// a timer is an outside clock, not derived state: it has to live in an effect
		const timer = window.setInterval(() => {
			setKey(getWaitingPhraseKey(Date.now() - startedAt))
		}, TICK_MS)
		return () => {
			window.clearInterval(timer)
		}
	}, [startedAt])

	return key
}
