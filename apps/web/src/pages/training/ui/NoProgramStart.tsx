import { useLiveWorkout } from '@/entities/workout'

import { EmptyWorkoutCard } from './EmptyWorkoutCard'
import { OpenWorkoutCard } from './OpenWorkoutCard'

/** The start of the tab without a program: the open session, or «Порожнє тренування». */
export const NoProgramStart = () => {
	const live = useLiveWorkout().data
	return live ? <OpenWorkoutCard live={live} /> : <EmptyWorkoutCard />
}
