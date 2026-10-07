import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Composer } from '@/features/send-message'
import { useToast } from '@/shared/ui'

import { SEED_VOICE_LEVELS } from '../../model/seed'
import { DevSection } from '../DevSection'

/** Seconds on the mockup timer (chat-voice: 0:07). */
const SEED_RECORDING_SECONDS = 7

export const ComposerSection = () => {
	const { t } = useTranslation()
	const toast = useToast()
	const [message, setMessage] = useState('')
	const [longMessage, setLongMessage] = useState(() => t('devUi.seed.longMessage'))
	const [isRecording, setIsRecording] = useState(true)

	const send = (text: string) => () => {
		toast.show(text)
	}

	return (
		<DevSection title={t('devUi.sections.composer')}>
			<Composer
				value={message}
				onValueChange={setMessage}
				onSubmit={send(message)}
				onVoiceStart={() => {
					setIsRecording(true)
				}}
			/>
			<Composer value={longMessage} onValueChange={setLongMessage} onSubmit={send(longMessage)} />
			{isRecording && (
				<Composer
					value=""
					onValueChange={setMessage}
					onSubmit={send(message)}
					voice={{
						elapsedSeconds: SEED_RECORDING_SECONDS,
						levels: SEED_VOICE_LEVELS,
						onCancel: () => {
							setIsRecording(false)
						},
						onStop: () => {
							setIsRecording(false)
						},
					}}
				/>
			)}
		</DevSection>
	)
}
