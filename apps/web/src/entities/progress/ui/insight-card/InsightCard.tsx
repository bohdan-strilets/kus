import type { ProgressInsight } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config'
import { HamsterHead, Icon, ICON_SIZE, Text } from '@/shared/ui'

import { buildInsight } from '../../lib/build-insight'

export interface InsightCardProps {
	insight: ProgressInsight
}

const HEAD_SIZE = 42

/**
 * mockups/progress.html dark card: the hamster's few sentences (templates over the backend's
 * facts, no AI) and the way into the chat. Nothing to say — no card.
 */
export const InsightCard = ({ insight }: InsightCardProps) => {
	const { t } = useTranslation()
	const sentences = buildInsight(insight, t)
	if (sentences.length === 0) return null

	return (
		<Link
			to={ROUTES.chat}
			className="flex min-h-tap items-start gap-3 rounded-bubble-ai bg-dark-card p-3.5 text-white"
		>
			<HamsterHead mood="proud" size={HEAD_SIZE} className="shrink-0" />
			<span className="flex flex-col gap-1">
				<Text as="span" variant="cardTitle" weight="regular" tone="onDark" className="leading-snug">
					{sentences.join(' ')}
				</Text>
				<Text
					as="span"
					variant="cardTitle"
					tone="accentOnDark"
					className="inline-flex items-center gap-0.5"
				>
					{t('progress.discuss')}
					<Icon name="chevron-right" size={ICON_SIZE.small} />
				</Text>
			</span>
		</Link>
	)
}
