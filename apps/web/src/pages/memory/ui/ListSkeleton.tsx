import { useTranslation } from 'react-i18next'

import { RowGroup, Skeleton } from '@/shared/ui'

const ROWS_COUNT = 5

interface ListSkeletonProps {
	/** Products have an icon tile before the lines; facts do not. */
	hasIcon: boolean
}

/** The shape of the list while it loads: rows with a name line and a muted line under it. */
export const ListSkeleton = ({ hasIcon }: ListSkeletonProps) => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')}>
			<RowGroup>
				{Array.from({ length: ROWS_COUNT }, (_, index) => (
					<div key={index} className="flex items-center gap-3 px-3.5 py-2.5">
						{hasIcon && <Skeleton shape="block" className="size-11 shrink-0" />}
						<div className="flex flex-1 flex-col gap-2">
							<Skeleton className="w-3/5" />
							<Skeleton className="w-2/5" />
						</div>
					</div>
				))}
			</RowGroup>
		</div>
	)
}
