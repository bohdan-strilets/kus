import { useEffect } from 'react'

import { unlockSound } from './sounds'

/**
 * Unlocks the audio on the first tap anywhere in the app: iOS lets a page start sound only
 * within a user gesture (design/docs/sounds.md, rule 2). `click`, not pointerdown — iOS doesn't
 * count a touchstart as that gesture. One listener, gone after the first tap or on unmount.
 */
export const useUnlockSoundOnFirstTap = (): void => {
	useEffect(() => {
		document.addEventListener('click', unlockSound, { once: true })
		return () => {
			document.removeEventListener('click', unlockSound)
		}
	}, [])
}
