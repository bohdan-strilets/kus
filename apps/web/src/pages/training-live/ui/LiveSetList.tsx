import { MAX_SETS_PER_EXERCISE } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { SetFields, SetRow } from '@/entities/workout'
import {
	getWeightStepKg,
	getWorkingNumber,
	isBodyweightExercise,
	type LiveDraftExercise,
	type LiveSession,
} from '@/features/live-workout'
import { Button, Icon, ICON_SIZE } from '@/shared/ui'

import { SetDoneToggle } from './SetDoneToggle'

interface LiveSetListProps {
	exercise: LiveDraftExercise
	exerciseIndex: number
	session: LiveSession
}

/** The sets of the current exercise: the one being edited is a block, the others are rows with a ✓. */
export const LiveSetList = ({ exercise, exerciseIndex, session }: LiveSetListProps) => {
	const { t } = useTranslation()
	const { current } = session
	const isBodyweight = isBodyweightExercise(exercise)
	const isAtLimit = exercise.sets.length >= MAX_SETS_PER_EXERCISE

	return (
		<div className="flex flex-col gap-2">
			{exercise.sets.map((set, setIndex) => {
				const ref = { exerciseIndex, setIndex }
				const label = set.isWarmup
					? t('training.live.warmupMark')
					: String(getWorkingNumber(exercise, setIndex))
				const isCurrent = current?.exerciseIndex === exerciseIndex && current.setIndex === setIndex
				if (isCurrent && set.doneAt === null) {
					return (
						<SetFields
							key={setIndex}
							title={t('training.live.setTitle', { n: label })}
							reps={set.reps}
							weightKg={set.weightKg}
							isBodyweight={isBodyweight}
							weightStepKg={getWeightStepKg(exercise)}
							onChange={(patch) => {
								session.changeSet(ref, patch)
							}}
						>
							<Button
								isFullWidth
								className="min-h-14 bg-success"
								icon={<Icon name="check" size={ICON_SIZE.control} />}
								onClick={() => {
									session.toggleDone(ref)
								}}
							>
								{t('training.live.setDone')}
							</Button>
						</SetFields>
					)
				}
				return (
					<SetRow
						key={setIndex}
						label={label}
						ariaLabel={t('training.live.setEdit', { n: label })}
						reps={set.reps}
						weightKg={set.weightKg}
						hasWeight={!isBodyweight}
						isWarmup={set.isWarmup}
						isDone={set.doneAt !== null}
						onSelect={() => {
							session.selectSet(ref)
						}}
						trailing={
							<SetDoneToggle
								label={label}
								isDone={set.doneAt !== null}
								onToggle={() => {
									session.toggleDone(ref)
								}}
							/>
						}
					/>
				)
			})}
			<div className="grid grid-cols-2 gap-2 pt-0.5">
				<Button
					variant="secondary"
					disabled={isAtLimit}
					onClick={() => {
						session.addSet(exerciseIndex)
					}}
				>
					{t('training.live.addSet')}
				</Button>
				<Button
					variant="secondary"
					className="border-2 border-dashed border-line-strong bg-transparent"
					disabled={isAtLimit}
					onClick={() => {
						session.addWarmup(exerciseIndex)
					}}
				>
					{t('training.live.addWarmup')}
				</Button>
			</div>
		</div>
	)
}
