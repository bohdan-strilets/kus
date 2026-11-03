import { useEffect, useState } from 'react'

/** The current moment, renewed every `intervalMs`: a running timer on screen. */
export const useNow = (intervalMs: number): Date => {
	const [now, setNow] = useState(() => new Date())

	useEffect(() => {
		const timer = setInterval(() => {
			setNow(new Date())
		}, intervalMs)
		return () => {
			clearInterval(timer)
		}
	}, [intervalMs])

	return now
}
