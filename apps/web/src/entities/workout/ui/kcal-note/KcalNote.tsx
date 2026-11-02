import type { WorkoutKcalView } from '../../lib/format-workout-kcal'

/** «≈ 350 ккал · оцінка»: the number in ink and bold, the source after it plain (mockups/training-session.html). */
export const KcalNote = ({ view }: { view: WorkoutKcalView }) =>
	view.tail === '' ? (
		view.note
	) : (
		<>
			<b className="font-bold text-ink">{view.value}</b>
			{view.tail}
		</>
	)
