import {
	TRAINING_ONBOARDING_MULTI_STEP,
	TRAINING_ONBOARDING_OPTIONS,
	type TrainingOnboarding,
	type TrainingOnboardingQuestionStep,
	type TrainingEquipment,
	type TrainingActivity,
	type TrainingLevel,
	type TrainingOnboardingState,
	type TrainingPerWeek,
	type TrainingPlace,
} from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useOutboxStore, useSendMessage } from '@/features/send-message'
import { cn } from '@/shared/lib'
import { Button, Chip, Text } from '@/shared/ui'

import { toggleEquipment } from '../../lib/toggle-equipment'
import { TrainingOptionRow } from './TrainingOptionRow'

type OnboardingOptionValue =
	TrainingPlace | TrainingActivity | TrainingLevel | TrainingPerWeek | TrainingEquipment

/** The experience question has a hint under each option, so it is a list of rows, not chips. */
const ROWS_STEP = 3 satisfies TrainingOnboardingQuestionStep

interface TrainingQuestionProps {
	messageId: string
	onboarding: TrainingOnboarding & { step: TrainingOnboardingQuestionStep }
	state: TrainingOnboardingState
}

/**
 * One question of the training onboarding in Kusik's bubble (mockups/training-onboarding.html): a
 * tap on an answer sends it as the user's message with its label; the equipment question takes
 * several and waits for «Готово». Answered, the options stay as they were chosen, without taps;
 * passed by, only the question remains.
 */
export const TrainingQuestion = ({ messageId, onboarding, state }: TrainingQuestionProps) => {
	const { t } = useTranslation()
	const { send } = useSendMessage()
	const { step, preselected, answer } = onboarding
	const [selected, setSelected] = useState<string[]>(answer ?? preselected)
	// the message turns ANSWERED only when the feed has the turn: until then a second tap must not
	// send; a failed answer unlocks the options again (the question is still OPEN)
	const isSending = useOutboxStore((store) =>
		Object.values(store.items).some(
			(item) => item.onboardingAnswer?.messageId === messageId && item.status !== 'failed',
		),
	)
	const isLocked = state !== 'OPEN' || isSending
	const isMulti = step === TRAINING_ONBOARDING_MULTI_STEP
	const question = t(`trainingOnboarding.question.${step}`)
	const options = TRAINING_ONBOARDING_OPTIONS[step]
	// the values come from the shared option lists, which the i18n keys follow one to one
	const getLabel = (value: string): string =>
		t(`trainingOnboarding.options.${value as OnboardingOptionValue}`)

	const submit = (values: string[]): void => {
		if (isLocked) return
		send({
			text: values.map(getLabel).join(', '),
			onboardingAnswer: { messageId, values },
		})
	}
	const chosen = options.filter((value) => selected.includes(value))

	return (
		<div className="flex flex-col gap-2.5">
			<Text>{question}</Text>
			{state !== 'CLOSED' && (
				<div
					role="group"
					aria-label={question}
					className={cn(step === ROWS_STEP ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2')}
				>
					{options.map((value) =>
						step === ROWS_STEP ? (
							<TrainingOptionRow
								key={value}
								label={getLabel(value)}
								hint={t(`trainingOnboarding.hints.${value as TrainingLevel}`)}
								isSelected={selected.includes(value)}
								isDisabled={isLocked}
								onSelect={() => {
									setSelected([value])
									submit([value])
								}}
							/>
						) : (
							<Chip
								key={value}
								variant="select"
								isSelected={selected.includes(value)}
								disabled={isLocked}
								className="min-h-tap px-4 font-bold disabled:opacity-100"
								onClick={() => {
									if (isMulti) {
										setSelected((current) => toggleEquipment(current, value))
										return
									}
									setSelected([value])
									submit([value])
								}}
							>
								{getLabel(value)}
							</Chip>
						),
					)}
				</div>
			)}
			{isMulti && state === 'OPEN' && (
				<Button
					size="lg"
					isFullWidth
					disabled={isLocked || chosen.length === 0}
					onClick={() => {
						submit(chosen)
					}}
				>
					{t('trainingOnboarding.done')}
				</Button>
			)}
		</div>
	)
}
