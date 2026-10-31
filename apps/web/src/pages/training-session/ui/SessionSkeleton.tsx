import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

const SECTION_SKELETONS = 3

/** The shape of the screen while it loads: three tiles and group cards. */
export const SessionSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2.5">
			<div className="flex gap-2">
				<Skeleton shape="block" className="h-18 flex-1 rounded-tile" />
				<Skeleton shape="block" className="h-18 flex-1 rounded-tile" />
				<Skeleton shape="block" className="h-18 flex-1 rounded-tile" />
			</div>
			{Array.from({ length: SECTION_SKELETONS }, (_, index) => (
				<Skeleton key={index} shape="block" className="h-32 rounded-bubble-ai" />
			))}
		</div>
	)
}
