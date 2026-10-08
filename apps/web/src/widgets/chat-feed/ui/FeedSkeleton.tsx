import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/ui'

/** The feed's shape while it loads: a user bubble, a meal card, another bubble (CLAUDE.md §12). */
export const FeedSkeleton = () => {
	const { t } = useTranslation()

	return (
		<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2.5">
			<Skeleton shape="block" className="h-11 w-3/5 self-end rounded-bubble" />
			<div className="flex items-end gap-2">
				<Skeleton shape="circle" className="size-8.5 shrink-0" />
				<Skeleton shape="block" className="h-44 flex-1 rounded-bubble-ai" />
			</div>
			<Skeleton shape="block" className="h-11 w-1/2 self-end rounded-bubble" />
		</div>
	)
}
