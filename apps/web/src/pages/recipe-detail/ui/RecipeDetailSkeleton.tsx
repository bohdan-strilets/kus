import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

const TILE_SKELETONS = 4

/** The shape of the screen while it loads: the hero, the title, four tiles and the composition. */
export const RecipeDetailSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
			<Skeleton shape="block" className="h-37.5 rounded-panel" />
			<Skeleton shape="block" className="h-12 rounded-tile" />
			<div className="grid grid-cols-4 gap-1.5">
				{Array.from({ length: TILE_SKELETONS }, (_, index) => (
					<Skeleton key={index} shape="block" className="h-14 rounded-tile-sm" />
				))}
			</div>
			<Skeleton shape="block" className="h-40 rounded-card" />
		</div>
	)
}
