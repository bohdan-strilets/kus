import { useTranslation } from 'react-i18next'

import { formatNumber } from '@/entities/workout'
import { Button, Icon, ICON_SIZE, Text } from '@/shared/ui'

interface ProgressHintProps {
	reps: number
	weightKg: number
	onTake: () => void
}

/** mockups/training-live.html «Підказка прогресу»: all working sets of the last time hit the top of the range. */
export const ProgressHint = ({ reps, weightKg, onTake }: ProgressHintProps) => {
	const { t } = useTranslation()

	return (
		<div className="flex items-center gap-2 rounded-tile bg-success-soft py-2 pr-2 pl-3">
			<Icon name="trend-flat" size={ICON_SIZE.control} className="flex-none text-success-ink" />
			<Text as="span" variant="caption" tone="successInk" className="min-w-0 flex-1">
				{t('training.live.hint', { reps, weight: formatNumber(weightKg) })}
			</Text>
			<Button size="md" className="bg-success" onClick={onTake}>
				{t('training.live.hintTake')}
			</Button>
		</div>
	)
}
