import { PROGRAM_DURATION_MIN_MAX } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatSetReps, GroupTag, NEW_CARDIO_MIN } from '@/entities/workout'
import type { LiveDraftExercise, LiveSession } from '@/features/live-workout'
import { Icon, ICON_SIZE, IconButton, SetStepper, Surface, Text } from '@/shared/ui'

interface LiveCardioProps {
	exercise: LiveDraftExercise
	exerciseIndex: number
	session: LiveSession
	onDeleteExercise: (origin: Element | null) => void
}

const MINUTE_STEP = 1
const MIN_MINUTES = 1

/** The cardio in hand: the minutes by a stepper (no sets, no weight); it counts as done while it has minutes. */
export const LiveCardio = ({
	exercise,
	exerciseIndex,
	session,
	onDeleteExercise,
}: LiveCardioProps) => {
	const { t } = useTranslation()
	const minutes = exercise.durationMin
	const setMinutes = (value: number): void => {
		session.changeCardioMinutes(
			exerciseIndex,
			Math.min(PROGRAM_DURATION_MIN_MAX, Math.max(MIN_MINUTES, value)),
		)
	}

	return (
		<Surface radius="chip" className="flex flex-col gap-2.5 p-3.5">
			<div className="flex items-start justify-between gap-2">
				<Text
					as="span"
					tabIndex={-1}
					data-live-exercise-title=""
					className="scroll-mt-4 text-field-number-sm font-extrabold focus:outline-none"
				>
					{exercise.name}
				</Text>
				<div className="-mt-1 -mr-1 -mb-1.5 flex items-center gap-1">
					<GroupTag group="CARDIO" />
					<IconButton
						label={t('workout.deleteExerciseAria', { name: exercise.name })}
						variant="ghost"
						className="text-muted-strong"
						onClick={(event) => {
							onDeleteExercise(event.currentTarget)
						}}
					>
						<Icon name="trash" size={ICON_SIZE.control} />
					</IconButton>
				</div>
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
