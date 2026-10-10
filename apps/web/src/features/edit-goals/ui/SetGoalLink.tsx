import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui'

/** The quiet «Задати ціль» under «з'їдено» while the day has no goal; the caller opens the sheet. */
export const SetGoalLink = ({ onClick }: { onClick: () => void }) => {
	const { t } = useTranslation()

	return (
		<Button variant="text" size="sm" aria-haspopup="dialog" onClick={onClick} className="-ml-4">
			{t('goal.set')}
		</Button>
	)
}
