import type { TrainingGroupKey } from '@kus/shared'

import { cn } from '@/shared/lib'

import { GroupDot } from '../group-dot'
import { DAY_DOTS_MAX } from './workout-day-dots.constants'

export interface WorkoutDayDotsProps {
	/** The groups of the day's trainings in the fixed order; the first three are drawn. */
	groups: readonly TrainingGroupKey[]
	/** The day has a training, even one without a group (a neutral dot then). */
	hasWorkout: boolean
	/** A day of the program without a training yet: a ring. */
	isPlanned: boolean
	/** On the dark pill of the current day: light colours. */
	isOnDark: boolean
}

/**
 * The indicator of «Тренування» in the week strip: up to three dots of the groups, or a ring on a
 * day the program planned. Decorative — the groups are named in the label of the day.
 */
export const WorkoutDayDots = ({
	groups,
	hasWorkout,
	isPlanned,
	isOnDark,
}: WorkoutDayDotsProps) => {
	if (hasWorkout) {
		const shown = groups.length > 0 ? groups.slice(0, DAY_DOTS_MAX) : [null]
		return shown.map((group) => (
			<GroupDot key={group ?? 'OTHER'} group={group} size="xs" tone={isOnDark ? 'onDark' : 'ink'} />
		))
	}
	if (!isPlanned) return null
	return (
		<span
			aria-hidden="true"
			className={cn(
				'size-1.5 rounded-full border',
				isOnDark ? 'border-hint-training-bg' : 'border-hint-training-ink',
			)}
		/>
	)
}
