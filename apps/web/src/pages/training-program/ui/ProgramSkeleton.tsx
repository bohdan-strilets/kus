import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

const CARD_COUNT = 2

/** The shape of the screen while the program loads: the version row, the toggle and the cards. */
export const ProgramSkeleton = () => {
	const { t } = useTranslation()
	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2">
			<Skeleton shape="block" className="h-11 rounded-bubble-ai" />
			<Skeleton shape="block" className="mt-1.5 ml-1 h-3.5 w-24" />
			<Skeleton shape="block" className="h-11 rounded-bubble-ai" />
			{Array.from({ length: CARD_COUNT }, (_, index) => (
				<Skeleton key={index} shape="block" className="h-28 rounded-card" />
			))}
		</div>
	)
}
