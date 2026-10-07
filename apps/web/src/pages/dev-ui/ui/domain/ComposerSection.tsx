import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Composer } from '@/features/send-message'
import { Text, useToast } from '@/shared/ui'

import { SEED_VOICE_LEVELS } from '../../model/seed'
import { DevSection } from '../DevSection'

/** Seconds on the mockup timer (chat-voice: 0:07). */
const SEED_RECORDING_SECONDS = 7

const ComposerState = ({ label, children }: { label: string; children: ReactNode }) => (
	<div className="flex flex-col gap-2">
		<Text variant="small" tone="muted">
			{label}
		</Text>
		{children}
	</div>
)

/** docs InputBar states; type into the first one to see the mic turn into «надіслати». */
export const ComposerSection = () => {
	const { t } = useTranslation()
	const toast = useToast()
	const [emptyMessage, setEmptyMessage] = useState('')
	const [shortMessage, setShortMessage] = useState(() => t('devUi.seed.shortMessage'))
	const [longMessage, setLongMessage] = useState(() => t('devUi.seed.longMessage'))
	const [isRecording, setIsRecording] = useState(true)
	const [onboardingMessage, setOnboardingMessage] = useState('')

	const send = (text: string) => () => {
		toast.show(text)
	}

	return (
		<DevSection title={t('devUi.sections.composer')}>
			<ComposerState label={t('devUi.composerStates.empty')}>
				<Composer
					value={emptyMessage}
					onValueChange={setEmptyMessage}
					onSubmit={send(emptyMessage)}
					onVoiceStart={() => {
						setIsRecording(true)
					}}
				/>
			</ComposerState>
			<ComposerState label={t('devUi.composerStates.short')}>
				<Composer
					value={shortMessage}
					onValueChange={setShortMessage}
					onSubmit={send(shortMessage)}
				/>
			</ComposerState>
			<ComposerState label={t('devUi.composerStates.onboarding')}>
				<Composer
					value={onboardingMessage}
					placeholder={t('onboarding.composerPlaceholder')}
					onValueChange={setOnboardingMessage}
					onSubmit={send(onboardingMessage)}
				/>
			</ComposerState>
			<ComposerState label={t('devUi.composerStates.long')}>
				<Composer value={longMessage} onValueChange={setLongMessage} onSubmit={send(longMessage)} />
			</ComposerState>
			{isRecording && (
				<ComposerState label={t('devUi.composerStates.voice')}>
					<Composer
						value=""
						onValueChange={setEmptyMessage}
						onSubmit={send(emptyMessage)}
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
				</ComposerState>
			)}
		</DevSection>
	)
}
