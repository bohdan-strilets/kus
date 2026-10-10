import { useTranslation } from 'react-i18next'

import { KusikRow } from '@/entities/message'
import { Skeleton } from '@/shared/ui'

import { RecalcBubble } from './RecalcBubble'

/** The bubble with the card in the shape of the real one. */
export const RecalcSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col">
			<KusikRow>
				<RecalcBubble>
					<div className="flex flex-col gap-2 px-3.5 pt-3.5 pb-2.5">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</div>
					<Skeleton shape="block" className="mx-2.5 h-56 rounded-chip" />
					<Skeleton shape="block" className="m-3.5 h-12" />
				</RecalcBubble>
			</KusikRow>
		</div>
	)
}
