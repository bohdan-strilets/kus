import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

/** The shape of the overview while the first load runs: two tiles, a chart card and the groups card. */
export const StatsSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('training.stats.loading')} className="flex flex-col gap-2.5">
			<div className="flex gap-2">
				<Skeleton shape="block" className="h-18 flex-1 rounded-tile" />
				<Skeleton shape="block" className="h-18 flex-1 rounded-tile" />
			</div>
			<Skeleton shape="block" className="h-40 rounded-bubble-ai" />
			<Skeleton shape="block" className="h-56 rounded-bubble-ai" />
		</div>
	)
}
