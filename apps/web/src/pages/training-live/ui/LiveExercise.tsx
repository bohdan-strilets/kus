import { useTranslation } from 'react-i18next'

import { formatLastSets, GroupTag, SetLine } from '@/entities/workout'
import { type LiveDraftExercise, type LiveSession, ProgressHint } from '@/features/live-workout'
import { Surface, Text } from '@/shared/ui'

import { formatPlanTarget, getHintToShow } from '../lib/live-exercise-view'
import { LiveSetList } from './LiveSetList'

interface LiveExerciseProps {
	exercise: LiveDraftExercise
	exerciseIndex: number
	session: LiveSession
	onDeleteExercise: (origin: Element | null) => void
}

/** mockups/training-live.html: the exercise in hand — name and group, goal, last time, the hint and the sets. */
export const LiveExercise = ({
	exercise,
	exerciseIndex,
	session,
	onDeleteExercise,
}: LiveExerciseProps) => {
	const { t } = useTranslation()
	const target = formatPlanTarget(exercise, t)
	const lastSets = formatLastSets(exercise.plan?.lastSets ?? null, t)
	const hint = getHintToShow(exercise)

	return (
		<Surface radius="card" className="flex flex-col gap-2.5 p-3.5">
			<div className="flex flex-col gap-1">
				<div className="flex items-start justify-between gap-2">
					<Text as="span" className="text-field-number-sm font-extrabold">
						{exercise.name}
					</Text>
					{exercise.muscleGroup !== null && <GroupTag group={exercise.muscleGroup} />}
				</div>
				{target !== null && (
					<Text as="span" variant="caption" tone="muted" weight="regular">
						{t('training.live.target', { target })}
					</Text>
				)}
				{lastSets !== null && (
					<span className="flex flex-wrap items-center gap-x-1.5">
						<Text as="span" variant="caption" tone="muted" weight="regular">
							{t('program.editor.lastTime')}
						</Text>
						<SetLine sets={lastSets} />
					</span>
				)}
			</div>
			{hint !== null && (
				<ProgressHint
					reps={hint.reps}
					weightKg={hint.weightKg}
					onTake={() => {
						session.takeHint(exerciseIndex)
					}}
				/>
			)}
			<LiveSetList
				exercise={exercise}
				exerciseIndex={exerciseIndex}
				session={session}
				onDeleteExercise={onDeleteExercise}
			/>
		</Surface>
	)
}
