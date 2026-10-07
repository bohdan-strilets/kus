import { type KeyboardEvent, type SubmitEvent, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { COARSE_POINTER_QUERY, cn, useMediaQuery } from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton, Text, Textarea } from '@/shared/ui'

import { getEnterAction } from '../../model/get-enter-action'
import { useIsMultiline } from '../../model/use-is-multiline'
import { ComposerAction } from './ComposerAction'
import type { ComposerProps } from './composer.types'
import { VoiceRecorder } from './VoiceRecorder'

/**
 * docs InputBar (the design spec wins over mockups/chat.html, which drew mic and send side by
 * side). One textarea for both layouts so it never remounts and keeps focus: single line — camera,
 * field and one primary slot that is the mic while empty and «надіслати» with text; long text
 * (chat-long-input.html) — the field on top, then camera, «Kusik розбере все на окремі продукти»
 * and send. Enter sends only with a physical keyboard (getEnterAction). While recording the bar
 * turns into the voice recorder. Presentational: the caller owns the text and the actions.
 */
export const Composer = ({
	value,
	placeholder,
	onValueChange,
	onSubmit,
	onPhotoClick,
	onVoiceStart,
	voice,
}: ComposerProps) => {
	const { t } = useTranslation()
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const { isMultiline, measure } = useIsMultiline(textareaRef, value, !voice)
	// whitespace alone is nothing to send
	const canSend = value.trim().length > 0
	const isCoarsePointer = useMediaQuery(COARSE_POINTER_QUERY)

	if (voice) return <VoiceRecorder {...voice} />

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault()
		if (!canSend) return
		onSubmit()
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
			<IconButton size="sm" label={t('composer.addPhoto')} onClick={onPhotoClick}>
				<Icon name="camera" size={ICON_SIZE.control} />
			</IconButton>
			<Textarea
				ref={textareaRef}
				name="message"
				aria-label={t('composer.label')}
				placeholder={placeholder ?? t('composer.placeholder')}
				value={value}
				onKeyDown={handleKeyDown}
				onChange={(event) => {
					onValueChange(event.target.value)
					measure()
				}}
				className={cn(isMultiline ? 'order-first basis-full pr-2.5' : 'flex-1 py-2')}
			/>
			{isMultiline ? (
				<>
					<Text as="span" variant="small" weight="regular" tone="muted" className="flex-1">
						{t('composer.longHint')}
					</Text>
					<IconButton type="submit" variant="primary" label={t('composer.send')}>
						<Icon name="send" size={ICON_SIZE.control} />
					</IconButton>
				</>
			) : (
				<ComposerAction canSend={canSend} onVoiceStart={onVoiceStart} />
			)}
		</form>
	)
}
