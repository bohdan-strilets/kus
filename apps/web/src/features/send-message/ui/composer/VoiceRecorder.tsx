import { TrashIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { IconButton, SendIcon, Text } from '@/shared/ui'

import { formatRecordingTime } from '../../model/format-recording-time'
import type { ComposerVoiceState } from './composer.types'

const TRASH_ICON_SIZE = 18

/**
 * The composer while recording (mockups/chat-voice.html): cancel, a red dot with the timer, the
 * live wave (.k-voice-wave from design/src/motion/motion.css) and «stop and send».
 */
export const VoiceRecorder = ({ elapsedSeconds, levels, onCancel, onStop }: ComposerVoiceState) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col gap-2.5">
			<Text
				as="p"
				variant="caption"
				tone="mutedStrong"
				className="self-center rounded-tile-sm bg-surface/75 px-3 py-1.5"
			>
				{t('composer.voiceHint')}
			</Text>
			<div className="flex items-center gap-2.5 rounded-panel bg-surface p-1.5 shadow-float ring-2 ring-primary/40">
				<IconButton
					variant="dangerSoft"
					size="sm"
					label={t('composer.cancelRecording')}
					onClick={onCancel}
				>
					<TrashIcon aria-hidden size={TRASH_ICON_SIZE} />
				</IconButton>
				<span className="flex shrink-0 items-center gap-1.5">
					<span aria-hidden="true" className="size-2.5 rounded-full bg-danger" />
					<Text as="span" variant="cardTitle" weight="extrabold" isTabular>
						{formatRecordingTime(elapsedSeconds)}
					</Text>
				</span>
				<span
					role="img"
					aria-label={t('composer.recording')}
					className="k-voice-wave min-w-0 flex-1"
				>
					{levels.map((level, index) => (
						// bar heights come from the mic level, so they are dynamic values
						<i key={index} style={{ height: level }} />
					))}
				</span>
				<IconButton variant="primary" label={t('composer.stopAndSend')} onClick={onStop}>
					<SendIcon />
				</IconButton>
			</div>
		</div>
	)
}
