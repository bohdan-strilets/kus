import { PROGRAM_DURATION_MIN_MAX } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatSetReps, GroupTag, NEW_CARDIO_MIN } from '@/entities/workout'
import type { LiveDraftExercise, LiveSession } from '@/features/live-workout'
import { SetStepper, Surface, Text } from '@/shared/ui'

interface LiveCardioProps {
	exercise: LiveDraftExercise
	exerciseIndex: number
	session: LiveSession
}

const MINUTE_STEP = 1
const MIN_MINUTES = 1

/** The cardio in hand: the minutes by a stepper (no sets, no weight); it counts as done while it has minutes. */
export const LiveCardio = ({ exercise, exerciseIndex, session }: LiveCardioProps) => {
	const { t } = useTranslation()
	const minutes = exercise.durationMin
	const setMinutes = (value: number): void => {
		session.changeCardioMinutes(
			exerciseIndex,
			Math.min(PROGRAM_DURATION_MIN_MAX, Math.max(MIN_MINUTES, value)),
		)
	}

	return (
		<Surface radius="card" className="flex flex-col gap-2.5 p-3.5">
			<div className="flex items-start justify-between gap-2">
				<Text as="span" className="text-field-number-sm font-extrabold">
					{exercise.name}
				</Text>
				<GroupTag group="CARDIO" />
			</div>
			<SetStepper
				value={minutes}
				valueText={formatSetReps(minutes)}
				unit={t('training.live.unitMin')}
				placeholder={t('training.live.minutesPlaceholder')}
				min={MIN_MINUTES}
				max={PROGRAM_DURATION_MIN_MAX}
				decimals={0}
				decreaseLabel={t('training.live.minutesLess')}
				increaseLabel={t('training.live.minutesMore')}
				editLabel={t('training.live.minutesEdit')}
				isDecreaseDisabled={minutes === null || minutes <= MIN_MINUTES}
				onDecrease={() => {
					setMinutes((minutes ?? MIN_MINUTES) - MINUTE_STEP)
				}}
				onIncrease={() => {
					// the first tap offers the plan's minutes (10 without a plan); later ones move by one
					setMinutes(
						minutes === null
							? (exercise.plan?.durationMin ?? NEW_CARDIO_MIN)
							: minutes + MINUTE_STEP,
					)
				}}
				onCommit={setMinutes}
			/>
		</Surface>
	)
}
