import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

const TILE_SKELETONS = 6

/** The shape of the grid while it loads: two columns of cards. */
export const RecipesSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div
			role="status"
			aria-label={t('common.loading')}
			className="mt-3 grid grid-cols-2 gap-2.5 px-gutter"
		>
			{Array.from({ length: TILE_SKELETONS }, (_, index) => (
				<Skeleton key={index} shape="block" className="h-38 rounded-card" />
			))}
		</div>
	)
}
