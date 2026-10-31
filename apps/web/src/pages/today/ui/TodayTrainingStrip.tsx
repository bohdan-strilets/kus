import type { WorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { GroupDot } from '@/entities/workout'
import { Icon } from '@/shared/ui'

import { getTrainingStripView, sortWorkoutsByTime } from '../lib/get-training-strip-view'

const STRIP_ICON_SIZE = 20
const CHEVRON_SIZE = 18

/**
 * «Було тренування» above the meals of «Сьогодні» (mockups/today-training.html): the time when
 * the session lasted, the groups as dots, a tap opens it. One strip per training, none for a quiet
 * day; no kcal — a workout never moves the ring.
 */
export const TodayTrainingStrip = ({ workouts }: { workouts: readonly WorkoutResponse[] }) => {
	const { t } = useTranslation()
	if (workouts.length === 0) return null

	const hasSiblings = workouts.length > 1
	return (
		<ul className="flex flex-col gap-2">
			{sortWorkoutsByTime(workouts).map((workout) => {
				const view = getTrainingStripView(workout, t, hasSiblings)
				return (
					<li key={view.id}>
						<Link
							to={view.href}
							aria-label={view.ariaLabel}
							className="flex min-h-tap items-center gap-2.5 rounded-bubble-ai bg-hint-training-bg px-3 text-hint-training-ink"
						>
							<Icon name="training" size={STRIP_ICON_SIZE} className="flex-none" />
							<span className="flex-1 text-card-title">
								{view.duration === null
									? t('today.trainingStrip.title')
									: t('today.trainingStrip.titleWithDuration', { duration: view.duration })}
								{view.time !== null && (
									<span className="font-medium">
										{' '}
										{t('today.trainingStrip.atTime', { time: view.time })}
									</span>
								)}
							</span>
							<span aria-hidden="true" className="flex gap-0.75">
								{view.groups.map((group) => (
									<GroupDot key={group} group={group} size="sm" />
								))}
							</span>
							<Icon name="chevron-right" size={CHEVRON_SIZE} className="flex-none" />
						</Link>
					</li>
				)
			})}
		</ul>
	)
}
