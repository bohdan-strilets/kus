import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

const SKELETON_ROWS = 4

/** The shape of the tab while it loads: the week card, a month label and rows of the journal. */
export const TrainingSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2.5">
			<Skeleton shape="block" className="h-28 rounded-panel" />
			<Skeleton shape="block" className="mt-1.5 ml-1 h-3.5 w-24" />
			<div className="flex flex-col divide-y divide-divider rounded-panel bg-surface/88 px-3.5 py-0.5">
				{Array.from({ length: SKELETON_ROWS }, (_, index) => (
					<div key={index} className="flex min-h-16 items-center gap-3 py-2">
						<Skeleton shape="block" className="h-10 w-11 flex-none" />
						<div className="flex flex-1 flex-col gap-1.5">
							<Skeleton shape="block" className="h-4 w-32" />
							<Skeleton shape="block" className="h-5 w-40" />
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
