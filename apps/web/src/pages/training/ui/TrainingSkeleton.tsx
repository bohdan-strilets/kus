import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

const SKELETON_CARDS = 2

/** The shape of the tab while it loads (training-tab): a day label and a card, twice. */
export const TrainingSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2.5">
			{Array.from({ length: SKELETON_CARDS }, (_, index) => (
				<div key={index} className="flex flex-col gap-2.5">
					<Skeleton shape="block" className="mt-1.5 ml-1 h-3.5 w-32" />
					<Skeleton shape="block" className="h-40 rounded-bubble-ai" />
				</div>
			))}
		</div>
	)
}
