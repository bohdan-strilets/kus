import { useTranslation } from 'react-i18next'

import { formatInteger, formatSignedInteger } from '@/shared/lib'
import { Text } from '@/shared/ui'

import type { DayCardVerdictAside as VerdictAside } from '../lib/get-day-card-verdict'

interface DayCardVerdictAsideProps {
	aside: VerdictAside
}

/**
 * Right of the ring on a closing card (mockups/chat-day-closed.html): «В цілі» in success-ink, the
 * excess in over-ink, the shortfall as a plain fact. Far below the goal there is nothing — the
 * numbers speak, no assessment.
 */
export const DayCardVerdictAside = ({ aside }: DayCardVerdictAsideProps) => {
	const { t } = useTranslation()

	if (aside.kind === 'none') return null
	if (aside.kind === 'inGoal') {
		return (
			<Text as="span" tone="successInk" className="text-title">
				{t('chat.dayCard.inGoal')}
			</Text>
		)
	}
	const isOver = aside.kind === 'over'
	return (
		<div className="flex min-w-0 flex-col">
			<Text
				as="span"
				weight="extrabold"
				tone={isOver ? 'overInk' : 'ink'}
				isTabular
				className="text-screen-title"
			>
				{isOver ? formatSignedInteger(aside.kcal) : formatInteger(aside.kcal)}
			</Text>
			<Text as="span" variant="small" weight="regular" tone={isOver ? 'overInk' : 'muted'}>
				{t(isOver ? 'gauge.overGoal' : 'chat.dayCard.underGoal')}
			</Text>
		</div>
	)
}
