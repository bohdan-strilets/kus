import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

/** The program part while it loads: the «Наступне» card, a label and the rows of the templates. */
export const TrainingProgramSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2.5">
			<Skeleton shape="block" className="h-40 rounded-card" />
			<Skeleton shape="block" className="mt-1.5 ml-1 h-3.5 w-24" />
			<Skeleton shape="block" className="h-28 rounded-panel" />
		</div>
	)
}
