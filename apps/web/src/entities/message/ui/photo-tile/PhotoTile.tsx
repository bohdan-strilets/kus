import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { touchSession } from '@/shared/api'
import { cn, TRANSITION } from '@/shared/lib'
import { Skeleton } from '@/shared/ui'

import { getPhotoTileHeight } from './get-photo-tile-height'
import { getPhotoUrl } from './get-photo-url'
import type { PhotoLoadOutcome, PhotoLoadStatus, PhotoTileProps } from './photo-tile.types'
import { photoTileVariants } from './photo-tile.variants'
import { PhotoTileError, PhotoTileMissing } from './PhotoTileState'

/**
 * One photo in a user bubble (mockups/photo-history.html). The height is known from the API before
 * the picture loads. A photo sent in this session shows its local copy and never swaps to the
 * server one, so nothing blinks; otherwise the thumb fades in over the skeleton.
 */
export const PhotoTile = ({
	fileId,
	width,
	height,
	previewUrl,
	alt,
	className,
}: PhotoTileProps) => {
	const { t } = useTranslation()
	const [outcome, setOutcome] = useState<PhotoLoadOutcome | null>(null)
	const [attempt, setAttempt] = useState(0)
	const [isPreviewBroken, setIsPreviewBroken] = useState(false)
	const [isRetrying, setIsRetrying] = useState(false)
	// state alone lags a render: a ref stops a second tap in the same tick
	const isRetryingRef = useRef(false)
	const tileHeight = getPhotoTileHeight(width, height)

	const retry = async (): Promise<void> => {
		if (isRetryingRef.current) return
		isRetryingRef.current = true
		setIsRetrying(true)
		// <img> bypasses axios, so an expired access token is renewed by a light request first;
		// whatever the result, the new <img> attempt may still succeed
		await touchSession()
		isRetryingRef.current = false
		setAttempt((count) => count + 1)
		setIsRetrying(false)
	}

	const isLocal = previewUrl !== undefined && !isPreviewBroken
	const src = isLocal ? previewUrl : fileId === null ? null : getPhotoUrl(fileId, 'thumb')

	if (src === null) return <PhotoTileMissing height={tileHeight} className={className} />

	// a new key reloads the same URL on «Повторити», without reloading the page
	const loadKey = `${src}#${attempt}`
	// derived: a new src or attempt starts from «loading» without an effect
	const status: PhotoLoadStatus = outcome?.key === loadKey ? outcome.status : 'loading'

	if (status === 'error' && !isRetrying) {
		return (
			<PhotoTileError
				height={tileHeight}
				className={className}
				onRetry={() => {
					void retry()
				}}
			/>
		)
	}

	const isShown = isLocal || status === 'loaded'

	return (
		<div
			// loading is a status, not an image: the screen reader announces it, the name comes with the photo
			role={isShown ? 'img' : 'status'}
			aria-label={isShown ? alt : t('chat.photoTile.loading')}
			style={{ height: tileHeight }}
			className={cn(photoTileVariants(), className)}
		>
			{!isShown && <Skeleton shape="block" className="absolute inset-0 rounded-none" />}
			{/* no <img> while the session is being renewed: it would hit the thumb with the old token */}
			{!isRetrying && (
				<motion.img
					key={loadKey}
					src={src}
					alt=""
					loading={isLocal ? undefined : 'lazy'}
					decoding="async"
					initial={false}
					animate={{ opacity: isShown ? 1 : 0 }}
					transition={TRANSITION.base}
					onLoad={() => {
						setOutcome({ key: loadKey, status: 'loaded' })
					}}
					onError={() => {
						// a revoked blob: fall back to the server copy; a server failure is the error tile
						if (isLocal) setIsPreviewBroken(true)
						else setOutcome({ key: loadKey, status: 'error' })
					}}
					className="size-full object-cover"
				/>
			)}
		</div>
	)
}
