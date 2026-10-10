import { useTranslation } from 'react-i18next'

import { getKusikFace, type KusikReplyKind } from '@/entities/message'
import { HamsterHead, Text } from '@/shared/ui'

import { DevSection } from '../DevSection'

const REPLY_KINDS: readonly KusikReplyKind[] = [
	'reply',
	'mealLogged',
	'clarify',
	'photoEstimate',
	'typing',
	'suggestion',
	'error',
	'newDay',
	'weeklySummary',
	'newRecipe',
	'weight',
	'welcomeBack',
]
const HEAD_SIZE = 40

/** Which face goes with which reply — the rules from the chat mockups. */
export const FacesSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.faces')} hint={t('devUi.seed.faceHint')}>
			<div className="grid grid-cols-4 gap-3">
				{REPLY_KINDS.map((kind) => (
					<figure key={kind} className="flex flex-col items-center gap-1">
						<HamsterHead mood={getKusikFace(kind)} size={HEAD_SIZE} />
						<Text as="span" variant="small" tone="muted" className="text-center break-all">
							{kind}
						</Text>
					</figure>
				))}
			</div>
		</DevSection>
	)
}
