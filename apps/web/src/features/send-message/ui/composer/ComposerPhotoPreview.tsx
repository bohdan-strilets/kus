import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Icon, IconButton, Loader, Text } from '@/shared/ui'

import type { ComposerPhotoState } from './composer.types'

const SPINNER_SIZE = 26
const ALERT_ICON_SIZE = 24
const REMOVE_ICON_SIZE = 12

const FALLBACK_ERROR_KEY = 'chat.photoInvalid'

/**
 * The one chat.* text of the reason is two sentences: what happened (danger), what to do (muted).
 * No regex lookbehind: it is a SyntaxError for the whole bundle in Safari before 16.4.
 */
const splitErrorText = (text: string): [string, string] => {
	const boundary = text.indexOf('. ')
	if (boundary === -1) return [text, '']
	return [text.slice(0, boundary + 1), text.slice(boundary + 2)]
}

interface ComposerPhotoPreviewProps {
	photo: ComposerPhotoState
}

/**
 * The row above the field (mockups/chat-photo-preview.html): the 64px thumbnail with «прибрати» on
 * its corner and a line of status beside it — the picked photo, the preparing, or what went wrong.
 * A photo that is still being prepared (or failed) has no picture, so the tile stays `field`.
 */
export const ComposerPhotoPreview = ({ photo }: ComposerPhotoPreviewProps) => {
	const { t } = useTranslation()

	if (photo.status === 'idle') return null

	const isError = photo.status === 'error'
	const [errorTitle, errorHint] = splitErrorText(t(photo.errorKey ?? FALLBACK_ERROR_KEY))

	return (
		<div className="order-first flex basis-full items-center gap-3 pt-2 pl-1">
			<div className="relative size-16 shrink-0">
				<div
					className={cn(
						'relative size-full overflow-hidden rounded-tile-sm bg-field',
						isError && 'ring-2 ring-danger',
					)}
				>
					{photo.status === 'ready' && photo.previewUrl && (
						<img
							src={photo.previewUrl}
							alt={t('composer.photoAlt')}
							className="size-full object-cover"
						/>
					)}
					{photo.status === 'processing' && (
						<span className="absolute inset-0 flex items-center justify-center bg-ink/45">
							<Loader size={SPINNER_SIZE} tone="onPrimary" ariaLabel={t('common.loading')} />
						</span>
					)}
					{isError && (
						<span className="absolute inset-0 flex items-center justify-center bg-surface/55 text-danger">
							<Icon name="alert" size={ALERT_ICON_SIZE} />
						</span>
					)}
				</div>
				<IconButton
					variant="ink"
					size="xs"
					label={t('composer.removePhoto')}
					onClick={photo.onRemove}
					className="absolute -top-2 -right-2"
				>
					<Icon name="close" size={REMOVE_ICON_SIZE} />
				</IconButton>
			</div>
			{photo.status === 'ready' && (
				<Text variant="small" tone="muted" weight="regular">
					{t('composer.photoHint')}
				</Text>
			)}
			{photo.status === 'processing' && (
				<Text role="status" variant="small" tone="muted" weight="regular">
					{t('composer.photoProcessing')}
				</Text>
			)}
			{isError && (
				<span role="alert" className="flex flex-col gap-0.5">
					<Text as="span" variant="small" tone="danger" weight="bold">
						{errorTitle}
					</Text>
					<Text as="span" variant="small" tone="muted" weight="regular">
						{errorHint}
					</Text>
				</span>
			)}
		</div>
	)
}
