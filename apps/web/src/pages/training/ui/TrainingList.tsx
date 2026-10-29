import { useTranslation } from 'react-i18next'

import { WorkoutCard } from '@/entities/workout'
import { DeleteWorkoutButton } from '@/features/delete-workout'
import { Text } from '@/shared/ui'

import { getGroupLabel } from '../lib/get-group-label'
import type { WorkoutDayGroup } from '../lib/group-workouts'

interface TrainingListProps {
	groups: readonly WorkoutDayGroup[]
	today: string
}

/** The trainings by day, newest first, each day under its own label. */
export const TrainingList = ({ groups, today }: TrainingListProps) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col gap-2.5">
			{groups.map((group) => (
				<section key={group.localDate} className="flex flex-col gap-2.5">
					<Text as="span" variant="eyebrow" tone="muted" className="px-1 pt-1.5">
						{getGroupLabel(group.localDate, today, t)}
					</Text>
					{group.workouts.map((workout) => (
						<WorkoutCard
							key={workout.id}
							workout={workout}
							footerAction={<DeleteWorkoutButton workout={workout} />}
						/>
					))}
				</section>
			))}
		</div>
	)
}
