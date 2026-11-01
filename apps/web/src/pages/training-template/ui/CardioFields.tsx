import {
	PROGRAM_DISTANCE_M_MAX,
	PROGRAM_DURATION_MIN_MAX,
	type TemplateExerciseTarget,
} from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatDecimal } from '@/shared/lib'
import { Stepper } from '@/shared/ui'

import { adjustDistance, adjustDuration, setDistanceKm, setDuration } from '../lib/adjust-target'

interface CardioFieldsProps {
	target: TemplateExerciseTarget
	onChange: (target: TemplateExerciseTarget) => void
}

const METERS_IN_KM = 1000
const EMPTY_VALUE = '—'
const MIN_DISTANCE_KM = 0.1
const DISTANCE_DECIMALS = 1

/** Cardio has no sets, weight or rest: minutes and/or kilometres. */
export const CardioFields = ({ target, onChange }: CardioFieldsProps) => {
	const { t } = useTranslation()
	const minutesLabel = t('program.editor.minutes')
	const distanceLabel = t('program.editor.distance')
	const { durationMin, distanceM } = target
	const distanceText =
		distanceM === null ? EMPTY_VALUE : formatDecimal(distanceM / METERS_IN_KM, DISTANCE_DECIMALS)

	return (
		<div className="grid grid-cols-2 gap-x-2 gap-y-3">
			<Stepper
				label={minutesLabel}
				valueText={durationMin === null ? EMPTY_VALUE : String(durationMin)}
				unit={durationMin === null ? undefined : t('program.editor.unitMin')}
				decreaseLabel={t('program.editor.less', { label: minutesLabel })}
				increaseLabel={t('program.editor.more', { label: minutesLabel })}
				edit={{
					min: 1,
					max: PROGRAM_DURATION_MIN_MAX,
					decimals: 0,
					inputValue: durationMin === null ? '' : String(durationMin),
					buttonLabel: t('program.editor.editValue', {
						label: minutesLabel,
						value: durationMin === null ? EMPTY_VALUE : String(durationMin),
					}),
					onCommit: (value) => {
						onChange(setDuration(target, value))
					},
				}}
				isDecreaseDisabled={durationMin === null}
				onDecrease={() => {
					onChange(adjustDuration(target, -1))
				}}
				onIncrease={() => {
					onChange(adjustDuration(target, 1))
				}}
			/>
			<Stepper
				label={distanceLabel}
				valueText={distanceText}
				unit={distanceM === null ? undefined : t('program.editor.unitKm')}
				decreaseLabel={t('program.editor.less', { label: distanceLabel })}
				increaseLabel={t('program.editor.more', { label: distanceLabel })}
				edit={{
					min: MIN_DISTANCE_KM,
					max: PROGRAM_DISTANCE_M_MAX / METERS_IN_KM,
					decimals: DISTANCE_DECIMALS,
					inputValue: distanceText === EMPTY_VALUE ? '' : distanceText,
					buttonLabel: t('program.editor.editValue', { label: distanceLabel, value: distanceText }),
					onCommit: (value) => {
						onChange(setDistanceKm(target, value))
					},
				}}
				isDecreaseDisabled={distanceM === null}
				onDecrease={() => {
					onChange(adjustDistance(target, -1))
				}}
				onIncrease={() => {
					onChange(adjustDistance(target, 1))
				}}
			/>
		</div>
	)
}
