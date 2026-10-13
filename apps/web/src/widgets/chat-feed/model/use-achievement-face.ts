import type { ChatMessage } from '@kus/shared'
import { useEffect, useState } from 'react'

import { pickAchievement } from '@/entities/achievement'
import { freshKey, useFreshOnMount } from '@/entities/message'
import { ACHIEVEMENT_POP_S } from '@/shared/lib'

const MS_IN_SECOND = 1000
const ACHIEVEMENT_FACE_DELAY_MS = ACHIEVEMENT_POP_S * MS_IN_SECOND

/**
 * Whether Kusik's face should turn happy for the achievement of this reply: only for a fresh one,
 * once the card has popped, so the head hops smile → happy together with it. A reply from the
 * history keeps its usual face, as a day goal closed earlier does.
 */
export const useAchievementFace = (message: ChatMessage): boolean => {
	const achievementId = pickAchievement(message.achievements)?.id
	// an empty key is never fresh
	const isFresh = useFreshOnMount(achievementId ? freshKey.achievement(achievementId) : '')
	const [isRevealed, setIsRevealed] = useState(false)

	useEffect(() => {
		if (!achievementId || !isFresh) return
		const timer = window.setTimeout(() => {
			setIsRevealed(true)
		}, ACHIEVEMENT_FACE_DELAY_MS)
		return () => {
			window.clearTimeout(timer)
		}
	}, [achievementId, isFresh])

	return isRevealed
}
