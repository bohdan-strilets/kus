import {
	type ChangeEvent,
	type KeyboardEvent,
	type SubmitEvent,
	useEffect,
	useId,
	useRef,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
	COARSE_POINTER_QUERY,
	cn,
	keepFieldFocus,
	requestViewportResync,
	useMediaQuery,
} from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton, Text, Textarea } from '@/shared/ui'

import { getEnterAction } from '../../model/get-enter-action'
import { useIsMultiline } from '../../model/use-is-multiline'
import { ComposerAction } from './ComposerAction'
import { ComposerPhotoPreview } from './ComposerPhotoPreview'
import type { ComposerProps } from './composer.types'
import { VoiceRecorder } from './VoiceRecorder'

/**
 * Any image: a narrower list hides files in some pickers. iOS hands over a library HEIC already
 * converted to JPEG; where the browser can't decode a file (HEIC outside Safari) compressImage
 * refuses it and the field says so. HEIC is not converted here on purpose.
 */
const PHOTO_INPUT_ACCEPT = 'image/*'

/**
 * docs InputBar (the design spec wins over mockups/chat.html, which drew mic and send side by
 * side). One textarea for both layouts so it never remounts and keeps focus: single line — camera,
 * field and one primary slot that is the mic while empty and «надіслати» with text; long text
 * (chat-long-input.html) — the field on top, then camera, «Kusik розбере все на окремі продукти»
 * and send. A picked photo is a row above the field. Enter sends only with a physical keyboard (getEnterAction). While recording the bar
 * turns into the voice recorder. Presentational: the caller owns the text and the actions.
 */
export const Composer = ({
	value,
	placeholder,
	onValueChange,
	onSubmit,
	onFocusChange,
	onFieldPress,
	onPhotoPick,
	onVoiceStart,
	voice,
	isPhotoEnabled = true,
	isPhotoBlocked = false,
	isVoiceEnabled = true,
	photo,
	maxLength,
	shouldFocus = false,
	onFocusHandled,
}: ComposerProps) => {
	const { t } = useTranslation()
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const { isMultiline, measure } = useIsMultiline(textareaRef, value, !voice)
	// whitespace alone is nothing to send; a photo still being prepared isn't there yet. A failed
	// photo adds nothing but doesn't block the words: the caller sends the text alone and drops it
	const hasContent = value.trim().length > 0 || photo?.status === 'ready'
	const canSend = hasContent && photo?.status !== 'processing'
	// while a photo is there the right slot is «надіслати», never the mic (chat-photo-preview)
	const hasPhoto = isPhotoEnabled && !!photo && photo.status !== 'idle'
	const isCoarsePointer = useMediaQuery(COARSE_POINTER_QUERY)
	const photoNoticeId = useId()

	// a DOM side effect, not derived state: the field exists only after the render
	useEffect(() => {
		const textarea = textareaRef.current
		if (!shouldFocus || !textarea) return
		textarea.focus()
		onFocusHandled?.()
	}, [shouldFocus, onFocusHandled])

	if (voice) return <VoiceRecorder {...voice} />

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault()
		if (!canSend) return
		onSubmit()
	}

	const openPhotoPicker = (): void => {
		// on a phone the keyboard closes first: iOS brings it back after the picker without telling the
		// visual viewport for a second or more, and the composer sits under its bar; one more tap for
		// the caption is the price of a predictable screen (plan-0.9.2)
		if (isCoarsePointer) textareaRef.current?.blur()
		fileInputRef.current?.click()
	}

	const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>): void => {
		const file = event.target.files?.[0]
		// the same file can be chosen again right after it was removed
		event.target.value = ''
		// back from the picker: re-read the visible box until it settles
		requestViewportResync()
		if (file) onPhotoPick?.(file)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
		const action = getEnterAction({
			key: event.key,
			shiftKey: event.shiftKey,
			isComposing: event.nativeEvent.isComposing,
			isCoarsePointer,
			hasText: canSend,
		})
		if (action === 'default') return
		event.preventDefault()
		if (action === 'send') event.currentTarget.form?.requestSubmit()
	}

	return (
		<form
			onSubmit={handleSubmit}
			className={cn(
				'flex flex-wrap items-center gap-2 bg-surface shadow-card focus-within:ring-2 focus-within:ring-primary',
				isMultiline ? 'rounded-card pt-3 pr-1.5 pb-1.5 pl-4' : 'rounded-panel p-1.5',
			)}
		>
			{isPhotoEnabled && isPhotoBlocked && (
				<Text
					id={photoNoticeId}
					role="status"
					variant="caption"
					tone="danger"
					weight="bold"
					className="order-first basis-full pt-1 pl-2"
				>
					{t('errors.api.DAILY_PHOTO_LIMIT_REACHED')}
				</Text>
			)}
			{isPhotoEnabled && photo && <ComposerPhotoPreview photo={photo} />}
			{isPhotoEnabled && (
				<>
					{/* no capture: iOS offers camera or library itself */}
					<input
						ref={fileInputRef}
						type="file"
						accept={PHOTO_INPUT_ACCEPT}
						tabIndex={-1}
						aria-hidden="true"
						className="hidden"
						onChange={handlePhotoChange}
					/>
					<IconButton
						size="sm"
						label={t('composer.addPhoto')}
						onClick={openPhotoPicker}
						onMouseDown={keepFieldFocus}
						disabled={isPhotoBlocked}
						aria-describedby={isPhotoBlocked ? photoNoticeId : undefined}
					>
						<Icon name="camera" size={ICON_SIZE.control} />
					</IconButton>
				</>
			)}
			<Textarea
				ref={textareaRef}
				name="message"
				aria-label={t('composer.label')}
				placeholder={
					hasPhoto
						? t('composer.photoCaptionPlaceholder')
						: (placeholder ?? t('composer.placeholder'))
				}
				value={value}
				maxLength={maxLength}
				onKeyDown={handleKeyDown}
				onFocus={() => onFocusChange?.(true)}
				onBlur={() => onFocusChange?.(false)}
				onClick={() => onFieldPress?.()}
				onChange={(event) => {
					onValueChange(event.target.value)
					measure()
				}}
				className={cn(
					isMultiline ? 'order-first basis-full pr-2.5' : 'flex-1 py-2',
					!isPhotoEnabled && !isMultiline && 'pl-2.5',
				)}
			/>
			{isMultiline ? (
				<>
					<Text as="span" variant="small" weight="regular" tone="muted" className="flex-1">
						{t('composer.longHint')}
					</Text>
					<IconButton
						type="submit"
						variant="primary"
						label={t('composer.send')}
						onMouseDown={keepFieldFocus}
						disabled={!canSend}
					>
						<Icon name="send" size={ICON_SIZE.control} />
					</IconButton>
				</>
			) : (
				<ComposerAction
					canSend={canSend}
					onVoiceStart={isVoiceEnabled ? onVoiceStart : undefined}
					isVoiceEnabled={isVoiceEnabled && !hasPhoto}
				/>
			)}
		</form>
	)
}
