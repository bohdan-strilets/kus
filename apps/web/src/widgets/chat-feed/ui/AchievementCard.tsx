import type { AchievementResponse } from '@kus/shared'
import { useCallback } from 'react'

import { AchievementCard as AchievementCardView } from '@/entities/achievement'
import { freshKey, useFreshOnMount, useFreshReplyStore } from '@/entities/message'

interface AchievementCardProps {
	achievement: AchievementResponse
}

/** An achievement card with its «just earned» celebration, played once per fresh reply. */
export const AchievementCard = ({ achievement }: AchievementCardProps) => {
	const key = freshKey.achievement(achievement.id)
	const isFresh = useFreshOnMount(key)
	const handleEntered = useCallback(() => {
		useFreshReplyStore.getState().release(key)
	}, [key])
	return (
		<AchievementCardView achievement={achievement} isFresh={isFresh} onEntered={handleEntered} />
	)
}
