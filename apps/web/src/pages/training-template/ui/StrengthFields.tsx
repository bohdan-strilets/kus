import {
	PROGRAM_REPS_MAX,
	PROGRAM_REPS_MIN,
	PROGRAM_SETS_MAX,
	PROGRAM_SETS_MIN,
	PROGRAM_WEIGHT_KG_MAX,
	PROGRESS_STEP_OPTIONS_KG,
	type TemplateExerciseTarget,
} from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatNumber } from '@/entities/workout'
import { Stepper } from '@/shared/ui'

import {
	adjustRepsMax,
	adjustRepsMin,
	adjustSets,
	adjustWeight,
	setRepsMax,
	setRepsMin,
	setSets,
	setWeight,
	type StepDirection,
} from '../lib/adjust-target'
import { REST_OPTIONS_SEC } from '../lib/template.constants'
import { ChoiceChips } from './ChoiceChips'

interface StrengthFieldsProps {
	target: TemplateExerciseTarget
	onChange: (target: TemplateExerciseTarget) => void
	/** No weight, so neither the weight stepper nor the progress step. */
	isBodyweight: boolean
}

type Adjust = (target: TemplateExerciseTarget, direction: StepDirection) => TemplateExerciseTarget
type SetValue = (target: TemplateExerciseTarget, value: number) => TemplateExerciseTarget

interface StepperSpec {
	label: string
	value: number | null
	adjust: Adjust
	setValue: SetValue
	min: number
	max: number
	decimals: number
	unit?: string
}

const EMPTY_VALUE = '—'
const WEIGHT_DECIMALS = 1

const formatValue = (value: number | null): string =>
	value === null ? EMPTY_VALUE : formatNumber(value)

/** Sets, weight and reps by steppers; the progress step (only with a weight) and the rest by chips. */
export const StrengthFields = ({ target, onChange, isBodyweight }: StrengthFieldsProps) => {
	const { t } = useTranslation()
	// 0 is the old way to say «власна вага»: the stepper reads it as no weight
	const weightKg = target.weightKg === 0 ? null : target.weightKg

	const renderStepper = ({
		label,
		value,
		adjust,
		setValue,
		min,
		max,
		decimals,
		unit,
	}: StepperSpec) => (
		<Stepper
			label={label}
			valueText={formatValue(value)}
			unit={value === null ? undefined : unit}
			decreaseLabel={t('program.editor.less', { label })}
			increaseLabel={t('program.editor.more', { label })}
			edit={{
				min,
				max,
				decimals,
				inputValue: value === null ? '' : formatNumber(value),
				buttonLabel: t('program.editor.editValue', { label, value: formatValue(value) }),
				onCommit: (next) => {
					onChange(setValue(target, next))
				},
			}}
			isDecreaseDisabled={value === null}
			onDecrease={() => {
				onChange(adjust(target, -1))
			}}
			onIncrease={() => {
				onChange(adjust(target, 1))
			}}
		/>
	)

	return (
		<>
			<div className="grid grid-cols-2 gap-x-2 gap-y-3">
				{renderStepper({
					label: t('program.editor.sets'),
					value: target.sets,
					adjust: adjustSets,
					setValue: setSets,
					min: PROGRAM_SETS_MIN,
					max: PROGRAM_SETS_MAX,
					decimals: 0,
				})}
				{!isBodyweight &&
					renderStepper({
						label: t('program.editor.weight'),
						value: weightKg,
						adjust: adjustWeight,
						setValue: setWeight,
						min: 0,
						max: PROGRAM_WEIGHT_KG_MAX,
						decimals: WEIGHT_DECIMALS,
						unit: t('program.editor.unitKg'),
					})}
				{renderStepper({
					label: t('program.editor.repsFrom'),
					value: target.repsMin,
					adjust: adjustRepsMin,
					setValue: setRepsMin,
					min: PROGRAM_REPS_MIN,
					max: PROGRAM_REPS_MAX,
					decimals: 0,
				})}
				{renderStepper({
					label: t('program.editor.repsTo'),
					value: target.repsMax,
					adjust: adjustRepsMax,
					setValue: setRepsMax,
					min: PROGRAM_REPS_MIN,
					max: PROGRAM_REPS_MAX,
					decimals: 0,
				})}
			</div>
			{!isBodyweight && weightKg !== null && (
				<ChoiceChips
					label={t('program.editor.progressStep')}
					options={PROGRESS_STEP_OPTIONS_KG.map((value) => ({
						value,
						text: t('program.target.progressStep', { value: formatNumber(value) }),
					}))}
					selected={target.progressStepKg}
					onSelect={(progressStepKg) => {
						onChange({ ...target, progressStepKg })
					}}
				/>
			)}
			<ChoiceChips
				label={t('program.editor.rest')}
				options={REST_OPTIONS_SEC.map((value) => ({
					value,
					text: t('workout.sec', { value }),
				}))}
				selected={target.restSec}
				onSelect={(restSec) => {
					onChange({ ...target, restSec })
				}}
			/>
		</>
	)
}
