import { Trans, useTranslation } from 'react-i18next'

import { BaseBottomSheet, Button, Text } from '@/shared/ui'

export interface KcalInfoSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
}

/** «Ккал на тренуванні» (mockups/training-session.html): how the number is made, and that it never joins the day's goal. */
export const KcalInfoSheet = ({ isOpen, onOpenChange }: KcalInfoSheetProps) => {
	const { t } = useTranslation()

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('workout.kcal.info.title')}
		>
			<Text>{t('workout.kcal.info.body')}</Text>
			<Text>
				{t('workout.kcal.info.approx')}{' '}
				<Trans
					i18nKey="workout.kcal.info.notGoal"
					components={{ b: <b className="font-bold" /> }}
				/>
			</Text>
			<Button
				isFullWidth
				onClick={() => {
					onOpenChange(false)
				}}
			>
				{t('workout.kcal.info.ok')}
			</Button>
		</BaseBottomSheet>
	)
}
