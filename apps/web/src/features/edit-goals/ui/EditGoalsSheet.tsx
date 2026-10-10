import { useTranslation } from 'react-i18next'

import { BaseBottomSheet } from '@/shared/ui'

import type { GoalValues } from '../lib/to-goal-values'
import { EditGoalsForm } from './EditGoalsForm'

interface EditGoalsSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	/** The goal in force; null — the first goal. */
	goal: GoalValues | null
}

/** The day's kcal and macros, set or changed; saved from today on, the rings fill from it. */
export const EditGoalsSheet = ({ isOpen, onOpenChange, goal }: EditGoalsSheetProps) => {
	const { t } = useTranslation()

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('editGoals.title')}
			description={t('editGoals.description')}
			initialFocus="first-field"
		>
			{isOpen && (
				<EditGoalsForm
					goal={goal}
					onSaved={() => {
						onOpenChange(false)
					}}
				/>
			)}
		</BaseBottomSheet>
	)
}
