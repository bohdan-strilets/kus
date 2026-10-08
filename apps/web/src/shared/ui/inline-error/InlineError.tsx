import { useTranslation } from 'react-i18next'

import { Icon, ICON_SIZE } from '../icon'
import { IconButton } from '../icon-button'
import { Surface } from '../surface'
import { Text } from '../text'

export interface InlineErrorProps {
	/** What failed, already translated: «Не вдалося завантажити день.» */
	message: string
	onRetry: () => void
}

/** A block that failed to load, in its own place, with «повторити» (CLAUDE.md §12). */
export const InlineError = ({ message, onRetry }: InlineErrorProps) => {
	const { t } = useTranslation()

	return (
		<Surface
			variant="translucent"
			role="alert"
			className="flex items-center justify-between gap-3 py-2 pr-2 pl-4"
		>
			<Text variant="caption" tone="muted">
				{message}
			</Text>
			<IconButton label={t('common.retry')} onClick={onRetry}>
				<Icon name="retry" size={ICON_SIZE.control} />
			</IconButton>
		</Surface>
	)
}
