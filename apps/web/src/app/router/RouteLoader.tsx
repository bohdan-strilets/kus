import { useTranslation } from 'react-i18next'

import { useDelayedFlag } from '@/shared/lib'
import { Loader } from '@/shared/ui'

const SCREEN_LOADER_SIZE = 120

/** Shown while a lazy route loads on first visit; appears only after 300 ms (CLAUDE.md §12). */
export const RouteLoader = () => {
	const { t } = useTranslation()
	const isShown = useDelayedFlag(true)
	if (!isShown) return null

	return (
		<div className="flex min-h-dvh items-center justify-center">
			<Loader size={SCREEN_LOADER_SIZE} ariaLabel={t('common.loading')} />
		</div>
	)
}
