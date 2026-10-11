import { useTranslation } from 'react-i18next'

import { useDelayedFlag } from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton, InlineError, Loader, Text } from '@/shared/ui'

import type { ComposerPhotoState } from './composer.types'

const LOADER_SIZE = 28

interface ComposerPhotoPreviewProps {
	photo: ComposerPhotoState
	/** The picked file didn't work: open the picker again. */
	onPickAgain: () => void
}

/** The row above the field: the picked photo with «прибрати», the preparing, or what went wrong. */
export const ComposerPhotoPreview = ({ photo, onPickAgain }: ComposerPhotoPreviewProps) => {
	const { t } = useTranslation()
	const isLoaderShown = useDelayedFlag(photo.status === 'processing')

	if (photo.status === 'idle') return null

	const removeButton = (
		<IconButton size="sm" label={t('composer.removePhoto')} onClick={photo.onRemove}>
			<Icon name="close" size={ICON_SIZE.control} />
		</IconButton>
	)

	if (photo.status === 'error') {
		return (
			<div className="order-first flex basis-full items-center gap-2">
				<div className="flex-1">
					<InlineError message={photo.errorKey ? t(photo.errorKey) : ''} onRetry={onPickAgain} />
				</div>
				{removeButton}
			</div>
		)
	}

	return (
		<div className="order-first flex basis-full items-center gap-3">
			{photo.status === 'ready' && photo.previewUrl && (
				<img
					src={photo.previewUrl}
					alt={t('composer.photoAlt')}
					className="size-14 rounded-tile object-cover"
				/>
			)}
			{photo.status === 'processing' && isLoaderShown && (
				<>
					<Loader size={LOADER_SIZE} ariaLabel={t('common.loading')} />
					<Text variant="small" tone="muted">
						{t('composer.photoProcessing')}
					</Text>
				</>
			)}
			{removeButton}
		</div>
	)
}
