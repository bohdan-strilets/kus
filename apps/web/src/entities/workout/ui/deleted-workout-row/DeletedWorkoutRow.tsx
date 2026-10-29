import type { WorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatShortDate, toCalendarDate } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

export interface DeletedWorkoutRowProps {
	workout: WorkoutResponse
	/** Next to Kusik's head; under his words it is an attachment without the tail. */
	hasTail?: boolean
}

/** mockups/chat-workout.html: a deleted training shrinks from its card to one quiet line. */
export const DeletedWorkoutRow = ({ workout, hasTail = true }: DeletedWorkoutRowProps) => {
	const { t } = useTranslation()

	return (
		<Surface
			radius={hasTail ? 'bubbleAi' : 'card'}
			shadow="none"
			className="bg-surface/55 px-3.5 py-2.5"
		>
			<Text variant="small" weight="regular" tone="muted">
				{t('workout.deleted', { date: formatShortDate(toCalendarDate(workout.localDate)) })}
			</Text>
		</Surface>
	)
}
