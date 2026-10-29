import type { WorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config'
import { formatTime } from '@/shared/lib'
import { Icon, Surface, Text } from '@/shared/ui'

import {
	formatExerciseNames,
	formatWorkoutKind,
	formatWorkoutMinutes,
} from '../../lib/format-workout'

const ROW_ICON_SIZE = 24

/**
 * The training under the meals of «Сьогодні» (mockups/today-workout.html): when, where and what,
 * and the time on the right. No kcal — a workout never moves the ring or «лишилось». Opens the tab.
 */
export const WorkoutDayRow = ({ workout }: { workout: WorkoutResponse }) => {
	const { t } = useTranslation()
	const names = formatExerciseNames(workout)
	const place = formatWorkoutKind(workout.place, t)

	return (
		<Link to={ROUTES.training} className="block">
			<Surface
				variant="frosted"
				radius="bubble"
				shadow="none"
				className="flex items-center gap-3 py-2.5 pr-3.5 pl-2.5"
			>
				<span className="flex size-11 flex-none items-center justify-center rounded-tile-sm bg-hint-training-bg text-protein-ink">
					<Icon name="training" size={ROW_ICON_SIZE} />
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-px">
					<Text as="span" variant="body" weight="bold">
						{t('workout.dayRow.title')}
						{workout.startedAt !== null && (
							<Text as="span" variant="small" weight="medium" tone="muted">
								{' '}
								{formatTime(new Date(workout.startedAt))}
							</Text>
						)}
					</Text>
					<Text as="span" variant="small" tone="muted" className="truncate">
						{names ? t('workout.dayRow.summary', { place, names }) : place}
					</Text>
				</span>
				{workout.durationMin !== null && (
					<span className="text-body font-extrabold text-hint-training-ink tabular-nums">
						{formatWorkoutMinutes(workout.durationMin, t)}
					</span>
				)}
			</Surface>
		</Link>
	)
}
