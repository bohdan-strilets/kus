import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

/** The shape of the screen while it loads: the progress card, two record tiles, the history. */
export const ExerciseSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2.5">
			<Skeleton shape="block" className="h-56 rounded-bubble-ai" />
			<div className="flex gap-2">
				<Skeleton shape="block" className="h-18 flex-1 rounded-tile" />
				<Skeleton shape="block" className="h-18 flex-1 rounded-tile" />
			</div>
			<Skeleton shape="block" className="h-40 rounded-bubble-ai" />
		</div>
	)
}
