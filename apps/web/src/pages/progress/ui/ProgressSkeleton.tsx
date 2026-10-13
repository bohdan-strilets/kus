import { useTranslation } from 'react-i18next'

import { Skeleton, Surface } from '@/shared/ui'

/** The shape of the two cards while the numbers load (CLAUDE.md §12). */
export const ProgressSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2.5">
			<Surface variant="list" radius="panel" className="flex flex-col gap-2.5 p-4">
				<Skeleton className="w-12" />
				<Skeleton shape="block" className="h-8 w-32" />
				<Skeleton shape="block" className="h-28" />
			</Surface>
			<Surface variant="list" radius="panel" className="flex flex-col gap-2.5 p-4">
				<Skeleton className="w-32" />
				<Skeleton shape="block" className="h-24" />
				<div className="grid grid-cols-2 gap-2">
					<Skeleton shape="block" className="h-14" />
					<Skeleton shape="block" className="h-14" />
				</div>
			</Surface>
		</div>
	)
}
