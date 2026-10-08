import { useEffect, useState } from 'react'

/** Often enough that a lost PENDING turn turns into «Не надіслано» soon after its 2 minutes. */
const TICK_MS = 30_000

/** The current moment, renewed on a timer: the feed judges how old a PENDING turn is by it. */
export const useNow = (): Date => {
	const [now, setNow] = useState(() => new Date())

	useEffect(() => {
		const timer = setInterval(() => {
			setNow(new Date())
		}, TICK_MS)
		return () => {
			clearInterval(timer)
		}
	}, [])

	return now
}
