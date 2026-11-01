import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

const ROW_COUNT = 5

/** The shape of the card of rows while the program loads. */
export const TemplateSkeleton = () => {
	const { t } = useTranslation()
	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2.5">
			<div className="flex flex-col gap-1 rounded-bubble-ai bg-surface-glass px-3.5 py-1">
				{Array.from({ length: ROW_COUNT }, (_, index) => (
					<Skeleton key={index} shape="block" className="my-1.5 h-10 w-full" />
				))}
			</div>
		</div>
	)
}
