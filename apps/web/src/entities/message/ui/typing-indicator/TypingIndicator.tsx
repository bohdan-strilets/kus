import { useTranslation } from 'react-i18next'

import { Text } from '@/shared/ui'

import { KusikRow } from '../kusik-row/KusikRow'

/**
 * «Kusik рахує…» (mockups/chat-typing.html): the think head and three dots in a wave — the endless
 * .k-typing loop from design/src/motion/motion.css — with the caption under the row.
 */
export const TypingIndicator = () => {
	const { t } = useTranslation()

	return (
		<div role="status" className="flex flex-col gap-1.5 self-stretch">
			<KusikRow kind="typing">
				<div className="self-start">
					<span aria-hidden="true" className="k-typing shadow-card">
						<i />
						<i />
						<i />
					</span>
				</div>
			</KusikRow>
			<Text as="span" variant="small" tone="muted" className="self-center">
				{t('chat.typing')}
			</Text>
		</div>
	)
}
