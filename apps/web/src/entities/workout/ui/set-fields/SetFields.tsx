import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from '@kus/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SetStepper, Text } from '@/shared/ui'

import {
	formatSetReps,
	formatSetWeight,
	stepReps,
	stepWeight,
	WEIGHT_DECIMALS,
} from '../../lib/set-edit'

export interface SetFieldsProps {
	/** «Підхід 2» (or the warm-up's own name). */
	title: string
	reps: number | null
	/** Ignored when `isBodyweight`: there is no weight to set. */
	weightKg: number | null
	isBodyweight: boolean
	/** The plan's progress step; the weight moves by it. */
	weightStepKg: number
	onChange: (patch: { reps?: number | null; weightKg?: number | null }) => void
	/** «Підхід виконано» of the live mode. */
	children?: ReactNode
}

/**
 * mockups/training-live.html «Поточний підхід»: the set being edited as a block with a `primary`
 * frame — weight and reps by 56px steppers (a tap on the number types it in).
 */
export const SetFields = ({
	title,
	reps,
	weightKg,
	isBodyweight,
	weightStepKg,
	onChange,
	children,
}: SetFieldsProps) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col gap-2.5 rounded-tile border-2 border-primary bg-surface p-3">
			<Text as="span" variant="eyebrow" tone="primaryDeep">
				{title}
			</Text>
			{!isBodyweight && (
				<SetStepper
					value={weightKg}
					valueText={formatSetWeight(weightKg)}
					unit={t('program.editor.unitKg')}
					placeholder={t('workout.set.weightPlaceholder')}
					min={0}
					max={MAX_SET_WEIGHT_KG}
					decimals={WEIGHT_DECIMALS}
					decreaseLabel={t('workout.set.weightLess')}
					increaseLabel={t('workout.set.weightMore')}
					editLabel={t('workout.set.weightEdit')}
					isDecreaseDisabled={weightKg === null || weightKg <= 0}
					onDecrease={() => {
						onChange({ weightKg: stepWeight(weightKg, weightStepKg, -1) })
					}}
					onIncrease={() => {
						onChange({ weightKg: stepWeight(weightKg, weightStepKg, 1) })
					}}
					onCommit={(value) => {
						onChange({ weightKg: value })
					}}
				/>
			)}
			<SetStepper
				value={reps}
				valueText={formatSetReps(reps)}
				unit={t('workout.repsUnit')}
				placeholder={t('workout.set.repsPlaceholder')}
				min={1}
				max={MAX_SET_REPS}
				decimals={0}
				decreaseLabel={t('workout.set.repsLess')}
				increaseLabel={t('workout.set.repsMore')}
				editLabel={t('workout.set.repsEdit')}
				isDecreaseDisabled={reps === null || reps <= 1}
				onDecrease={() => {
					onChange({ reps: stepReps(reps, -1) })
				}}
				onIncrease={() => {
					onChange({ reps: stepReps(reps, 1) })
				}}
				onCommit={(value) => {
					onChange({ reps: value })
				}}
			/>
			{children}
		</div>
	)
}
