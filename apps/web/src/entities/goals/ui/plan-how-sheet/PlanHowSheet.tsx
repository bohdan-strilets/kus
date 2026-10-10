import { useTranslation } from 'react-i18next'

import { BaseBottomSheet, Button, HamsterHead, Text } from '@/shared/ui'

import type { PlanStep } from '../../model/plan-step.types'
import { PlanStepRow } from './PlanStepRow'

const HEAD_SIZE = 40

export interface PlanHowSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	steps: PlanStep[]
}

/** onboarding-5-plan-how: the calculation behind the goals, step by step. */
export const PlanHowSheet = ({ isOpen, onOpenChange, steps }: PlanHowSheetProps) => {
	const { t } = useTranslation()

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('planHow.title')}
			headerSlot={<HamsterHead mood="think" size={HEAD_SIZE} />}
			headerSlotPlacement="start"
			hasCloseButton={false}
		>
			<ol className="flex flex-col">
				{steps.map((step, index) => (
					<PlanStepRow key={step.title} index={index + 1} step={step} />
				))}
			</ol>
			<Text variant="caption" weight="regular" tone="mutedStrong">
				{t('planHow.note')}
			</Text>
			<Button
				isFullWidth
				onClick={() => {
					onOpenChange(false)
				}}
			>
				{t('planHow.ok')}
			</Button>
		</BaseBottomSheet>
	)
}
