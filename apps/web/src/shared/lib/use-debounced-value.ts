import { useEffect, useState } from 'react'

/** The value after it has stayed the same for `delayMs`: a search asks the server once the typing pauses. */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
	const [debounced, setDebounced] = useState(value)

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebounced(value)
		}, delayMs)
		return () => {
			clearTimeout(timer)
		}
	}, [value, delayMs])

	return debounced
}
