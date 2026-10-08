import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui'

import { SetGoalSheet } from './SetGoalSheet'

/** The quiet «Задати ціль» under «з'їдено» while the day has no goal; opens the goal sheet. */
export const SetGoalLink = () => {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = useState(false)

	return (
		<>
			<Button
				variant="text"
				size="sm"
				aria-haspopup="dialog"
				onClick={() => {
					setIsOpen(true)
				}}
				className="-ml-4"
			>
				{t('goal.set')}
			</Button>
			<SetGoalSheet isOpen={isOpen} onOpenChange={setIsOpen} />
		</>
	)
}
