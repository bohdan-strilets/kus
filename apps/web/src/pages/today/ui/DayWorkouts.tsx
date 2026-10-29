import { useQuery } from '@tanstack/react-query'

import { WorkoutDayRow, workoutsDayQueryOptions } from '@/entities/workout'

/**
 * The trainings of the day under its meals. A failed or pending read draws nothing: the meals and
 * the ring are the screen, and a workout row must never break them.
 */
export const DayWorkouts = ({ localDate }: { localDate: string }) => {
	const { data } = useQuery(workoutsDayQueryOptions(localDate))
	if (!data || data.length === 0) return null

	return (
		<ul className="flex flex-col gap-2">
			{data.map((workout) => (
				<li key={workout.id}>
					<WorkoutDayRow workout={workout} />
				</li>
			))}
		</ul>
	)
}
