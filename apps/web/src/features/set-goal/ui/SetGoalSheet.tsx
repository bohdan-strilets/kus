import type { DailyGoal } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { BaseBottomSheet } from '@/shared/ui'

import { SetGoalForm } from './SetGoalForm'

interface SetGoalSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	/** The goal in force; null — the first goal. */
	goal: DailyGoal | null
}

/** The day's kcal and macros, set or changed; saved from today on, the rings fill from it. */
export const SetGoalSheet = ({ isOpen, onOpenChange, goal }: SetGoalSheetProps) => {
	const { t } = useTranslation()

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('goal.title')}
			description={t('goal.description')}
		>
			<SetGoalForm
				goal={goal}
				onSaved={() => {
					onOpenChange(false)
				}}
			/>
		</BaseBottomSheet>
	)
}
