import { useTranslation } from 'react-i18next'

import { Text } from '@/shared/ui'

import { useWaitingPhrase } from '../../model/use-waiting-phrase'
import { KusikRow } from '../kusik-row/KusikRow'

export interface TypingIndicatorProps {
	/** uploading: the photo is still on its way, so there is nothing to think about yet. */
	phase?: 'uploading' | 'thinking'
}

/** Its own component: the phrase timer runs only while Kusik really is thinking. */
const ThinkingPhrase = () => {
	const { t } = useTranslation()
	const phraseKey = useWaitingPhrase()
	return <>{t(phraseKey)}</>
}

/**
 * Kusik is thinking (mockups/chat-typing.html): the think head and three dots in a wave — the
 * endless .k-typing loop from design/src/motion/motion.css, still under reduced motion — and a
 * phrase under the row that changes every ~2.5 s. Screen readers hear only the first one. While a
 * photo is uploading the phrase is a single «Надсилаю фото…».
 */
export const TypingIndicator = ({ phase = 'thinking' }: TypingIndicatorProps) => {
	const { t } = useTranslation()
	const isUploading = phase === 'uploading'

	return (
		// relative: the sr-only status is absolute and would stretch the page from the feed bottom
		<div className="relative flex flex-col gap-1.5 self-stretch">
			<span role="status" className="sr-only">
				{t(isUploading ? 'chat.waiting.uploading' : 'chat.waiting.thinking')}
			</span>
			<KusikRow kind="typing">
				<div className="self-start">
					<span aria-hidden="true" className="k-typing shadow-card">
						<i />
						<i />
						<i />
					</span>
				</div>
			</KusikRow>
			<Text as="span" variant="small" tone="muted" aria-hidden="true" className="self-center">
				{isUploading ? t('chat.waiting.uploading') : <ThinkingPhrase />}
			</Text>
		</div>
	)
}
