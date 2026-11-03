import { MAX_EXERCISES_PER_WORKOUT, type ProgramTemplateResponse } from '@kus/shared'
import { useState } from 'react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ExercisePickerSheet } from '@/entities/workout'
import {
	createFormExercise,
	ExercisePlanRow,
	type FormNow,
	useWorkoutForm,
} from '@/features/workout-form'
import { ROUTES } from '@/shared/config'
import { createUuid, useStackBack } from '@/shared/lib'
import {
	Button,
	DashedAction,
	FormField,
	Heading,
	Icon,
	ICON_SIZE,
	IconButton,
	Input,
	Text,
} from '@/shared/ui'
import { WorkoutFinishScreen } from '@/widgets/workout-finish'

import { FillWhenCard } from './FillWhenCard'

interface FillScreenProps {
	/** null: an empty session. */
	template: ProgramTemplateResponse | null
	now: FormNow
}

const SAVE_BUTTON_CLASS = 'min-h-13'

/**
 * mockups/training-form.html: the template's plan filled in, only the deviations are edited —
 * «Коли» and «Тривалість» on top, the exercises with «Як за планом», one [Зберегти] at the bottom
 * (never disabled: pressing it shows every problem at once). After saving, the same summary as
 * after the live mode.
 */
export const FillScreen = ({ template, now }: FillScreenProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const goBack = useStackBack(ROUTES.training)
	const { form, exercises, changeDuration, applyWhen, onSubmit, isSaving, finished } =
		useWorkoutForm({ template, now })
	const [isPickerOpen, setIsPickerOpen] = useState(false)
	const { errors } = form.formState
	const exercisesError = errors.exercises?.message ?? errors.exercises?.root?.message

	if (finished) {
		return (
			<WorkoutFinishScreen
				finished={finished}
				onDone={() => {
					void navigate(ROUTES.training, { replace: true })
				}}
			/>
		)
	}

	return (
		<form
			noValidate
			onSubmit={(event) => {
				void onSubmit(event)
			}}
			className="flex min-h-0 flex-1 flex-col"
		>
			<header className="flex items-center gap-3 px-gutter pt-5.5 pb-2">
				<IconButton label={t('training.form.close')} variant="frosted" onClick={goBack}>
					<Icon name="close" size={ICON_SIZE.control} />
				</IconButton>
				<div className="flex min-w-0 flex-1 flex-col">
					<Heading as="h1">{t('training.form.title')}</Heading>
					<Text variant="caption" tone="muted" className="truncate">
						{template?.name ?? t('training.live.defaultName')}
					</Text>
				</div>
			</header>
			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-gutter pb-4">
				<div className="grid grid-cols-2 gap-2">
					<FillWhenCard form={form} today={now.localDate} onApply={applyWhen} />
					<Controller
						control={form.control}
						name="durationMin"
						render={({ field, fieldState }) => (
							<FormField
								label={t('training.form.duration')}
								error={fieldState.error?.message}
								attemptCount={form.formState.submitCount}
								endSlot={
									<Text as="span" variant="caption" tone="muted">
										{t('training.live.unitMin')}
									</Text>
								}
							>
								{(controlProps) => (
									<Input
										{...controlProps}
										inputMode="numeric"
										autoComplete="off"
										value={field.value === null ? '' : String(field.value)}
										onChange={(event) => {
											const digits = event.target.value.replace(/\D/g, '')
											changeDuration(digits === '' ? null : Number(digits))
										}}
										onBlur={field.onBlur}
									/>
								)}
							</FormField>
						)}
					/>
				</div>
				{exercises.fields.map((field, index) => (
					<ExercisePlanRow
						key={field.key}
						exercise={field}
						onChange={(next) => {
							exercises.update(index, next)
						}}
					/>
				))}
				<DashedAction
					isDisabled={exercises.fields.length >= MAX_EXERCISES_PER_WORKOUT}
					onClick={() => {
						setIsPickerOpen(true)
					}}
				>
					{t('program.editor.addExercise')}
				</DashedAction>
			</div>
			<div className="flex flex-col gap-2 px-gutter pt-2 pb-4">
				{exercisesError && (
					<Text role="alert" variant="caption" tone="danger" className="text-center">
						{exercisesError}
					</Text>
				)}
				<Button type="submit" isFullWidth isLoading={isSaving} className={SAVE_BUTTON_CLASS}>
					{t('training.form.save')}
				</Button>
			</div>
			<ExercisePickerSheet
				isOpen={isPickerOpen}
				onOpenChange={setIsPickerOpen}
				onPick={(pick) => {
					exercises.append(createFormExercise(pick, createUuid()))
					setIsPickerOpen(false)
				}}
			/>
		</form>
	)
}
