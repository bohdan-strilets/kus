import { type TemplateExerciseTarget, templateExerciseTargetSchema } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getExerciseGroup } from '@/entities/program'
import { formatLastSets, GroupTag, SetLine } from '@/entities/workout'
import { Button, Icon, ICON_SIZE, Switch, Text } from '@/shared/ui'

import type { DraftExercise } from '../lib/template-draft.types'
import { CardioFields } from './CardioFields'
import { StrengthFields } from './StrengthFields'

interface TargetFormProps {
	exercise: DraftExercise
	onSave: (target: TemplateExerciseTarget, isBodyweight: boolean | null) => void
	onRemove: () => void
}

/** The body of «Ціль вправи»: the tag and the last result, the steppers and chips, «Зберегти», «Прибрати». */
export const TargetForm = ({ exercise, onSave, onRemove }: TargetFormProps) => {
	const { t } = useTranslation()
	const [target, setTarget] = useState(exercise.target)
	// null = the dictionary decides; only the person's own switch is written
	const [isBodyweight, setIsBodyweight] = useState(exercise.isBodyweight ?? null)
	const isBodyweightOn = isBodyweight === true
	const group = getExerciseGroup(exercise)
	const lastSets = exercise.kind === 'CARDIO' ? null : formatLastSets(exercise.lastSets, t)
	// the steppers keep the target valid; the schema is the last word before it reaches the draft
	const isValid = templateExerciseTargetSchema.safeParse(target).success

	return (
		<>
			{(group !== null || lastSets !== null) && (
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					{group !== null && <GroupTag group={group} />}
					{lastSets !== null && (
						<div className="flex flex-wrap items-center gap-x-1.5">
							<Text as="span" variant="caption" tone="muted" weight="regular">
								{t('program.editor.lastTime')}
							</Text>
							<SetLine sets={lastSets} />
						</div>
					)}
				</div>
			)}
			{exercise.kind !== 'CARDIO' && (
				<div className="flex min-h-tap items-center justify-between gap-3">
					<Text as="span" variant="body" weight="bold">
						{t('program.editor.bodyweight')}
					</Text>
					<Switch
						isChecked={isBodyweightOn}
						label={t('program.editor.bodyweight')}
						onCheckedChange={(isChecked) => {
							setIsBodyweight(isChecked)
							// a bodyweight exercise has no weight and no progress step
							if (isChecked) setTarget({ ...target, weightKg: null, progressStepKg: null })
						}}
					/>
				</div>
			)}
			{exercise.kind === 'CARDIO' ? (
				<CardioFields target={target} onChange={setTarget} />
			) : (
				<StrengthFields target={target} onChange={setTarget} isBodyweight={isBodyweightOn} />
			)}
			<Button
				isFullWidth
				disabled={!isValid}
				onClick={() => {
					onSave(target, isBodyweight)
				}}
			>
				{t('program.editor.save')}
			</Button>
			<Button
				variant="textDanger"
				icon={<Icon name="trash" size={ICON_SIZE.small} />}
				onClick={onRemove}
			>
				{t('program.editor.removeFromWorkout')}
			</Button>
		</>
	)
}
