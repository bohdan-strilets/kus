import { useTranslation } from 'react-i18next'

import { Icon, ICON_SIZE, Text } from '@/shared/ui'

import { photoTileVariants } from './photo-tile.variants'

interface PhotoTileStateProps {
	height: number
	className?: string
}

/** The file is gone: neutral, no retry (it would not help). */
export const PhotoTileMissing = ({ height, className }: PhotoTileStateProps) => {
	const { t } = useTranslation()
	return (
		<div
			role="img"
			aria-label={t('chat.photoTile.missing')}
			style={{ height }}
			className={photoTileVariants({ tone: 'missing', className })}
		>
			<Icon name="image-off" size={ICON_SIZE.nav} className="text-muted" />
			<Text variant="small" tone="muted" weight="semibold" className="px-2.5">
				{t('chat.photoTile.missing')}
			</Text>
		</div>
	)
}

interface PhotoTileErrorProps extends PhotoTileStateProps {
	onRetry: () => void
}

/** The storage didn't answer: only this tile can be retried; the entry in the chat doesn't depend on it. */
export const PhotoTileError = ({ height, className, onRetry }: PhotoTileErrorProps) => {
	const { t } = useTranslation()
	return (
		<div
			role="group"
			style={{ height }}
			className={photoTileVariants({ tone: 'error', className })}
		>
			<Icon name="alert" size={ICON_SIZE.nav} className="text-danger" />
			<Text variant="small" weight="bold" className="px-2">
				{t('chat.photoTile.loadFailed')}
			</Text>
			<button
				type="button"
				onClick={onRetry}
				className="-mt-1 inline-flex min-h-tap cursor-pointer items-center gap-1.5 px-3.5 text-caption font-bold text-primary-deep"
			>
				<Icon name="retry" size={ICON_SIZE.control} />
				{t('chat.photoTile.retry')}
			</button>
		</div>
	)
}
