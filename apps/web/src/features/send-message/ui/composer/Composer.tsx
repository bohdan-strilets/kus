import { type SubmitEvent, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { CameraIcon, IconButton, MicIcon, SendIcon, Text, Textarea } from '@/shared/ui'

import { useIsMultiline } from '../../model/use-is-multiline'
import type { ComposerProps } from './composer.types'
import { VoiceRecorder } from './VoiceRecorder'

/**
 * docs InputBar. One textarea for both layouts so it never remounts and keeps focus:
 * single line (mockups/chat.html) — camera, field, mic, send; long text (chat-long-input.html) —
 * the field on top, then camera, «Kusik розбере все на окремі продукти» and send. While recording
 * the bar turns into the voice recorder. Presentational: the caller owns the text and the actions.
 */
export const Composer = ({
	value,
	onValueChange,
	onSubmit,
	onPhotoClick,
	onVoiceStart,
	voice,
}: ComposerProps) => {
	const { t } = useTranslation()
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const { isMultiline, measure } = useIsMultiline(textareaRef, value, !voice)

	if (voice) return <VoiceRecorder {...voice} />

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault()
		onSubmit()
	}

	return (
		<form
			onSubmit={handleSubmit}
			className={cn(
				'flex flex-wrap items-center gap-2 bg-surface shadow-float focus-within:ring-2 focus-within:ring-primary',
				isMultiline ? 'rounded-card pt-3 pr-1.5 pb-1.5 pl-4' : 'rounded-panel p-1.5',
			)}
		>
			<IconButton size="sm" label={t('composer.addPhoto')} onClick={onPhotoClick}>
				<CameraIcon />
			</IconButton>
			<Textarea
				ref={textareaRef}
				aria-label={t('composer.label')}
				placeholder={t('composer.placeholder')}
				value={value}
				onChange={(event) => {
					onValueChange(event.target.value)
					measure()
				}}
				className={cn(isMultiline ? 'order-first basis-full pr-2.5' : 'flex-1 py-2')}
			/>
			{isMultiline ? (
				<Text as="span" variant="small" weight="regular" tone="muted" className="flex-1">
					{t('composer.longHint')}
				</Text>
			) : (
				<IconButton size="sm" label={t('composer.voice')} onClick={onVoiceStart}>
					<MicIcon />
				</IconButton>
			)}
			<IconButton type="submit" variant="primary" label={t('composer.send')}>
				<SendIcon />
			</IconButton>
		</form>
	)
}
