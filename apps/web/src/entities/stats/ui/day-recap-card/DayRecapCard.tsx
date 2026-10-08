import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatInteger } from '@/shared/lib'
import { Icon, ICON_SIZE, Text } from '@/shared/ui'

import { getGaugeState } from '../../lib/get-gauge-state'
import { getRecapProteinKey } from '../../lib/get-recap-protein-key'

export interface DayRecapCardProps {
	eaten: number
	goal: number | null
	protein: number
	proteinGoal: number | null
	/** The day this recap opens on «Сьогодні». */
	to: string
}

const CHECK_SIZE = 20

/**
 * «Підсумок дня» of the day before (mockups/chat-new-day.html): a check on success-soft when the
 * day stayed within the goal (no icon otherwise — over is never an error), kcal, protein, ›.
 */
export const DayRecapCard = ({ eaten, goal, protein, proteinGoal, to }: DayRecapCardProps) => {
	const { t } = useTranslation()
	const isWithinGoal = goal !== null && getGaugeState(eaten, goal).status !== 'over'

	return (
		<Link
			to={to}
			className="flex items-center gap-3 self-stretch rounded-bubble bg-surface/75 px-3.5 py-3 text-ink"
		>
			{isWithinGoal && (
				<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
					<Icon name="check" size={CHECK_SIZE} />
				</span>
			)}
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<Text as="span" variant="cardTitle" isTabular>
					{t('chat.dayRecap.title', { kcal: formatInteger(eaten) })}
				</Text>
				<Text as="span" variant="small" weight="regular" tone="muted">
					{t(getRecapProteinKey(protein, proteinGoal), {
						protein: formatInteger(protein),
						goal: proteinGoal === null ? '' : formatInteger(proteinGoal),
					})}
				</Text>
			</span>
			<Icon name="chevron-right" size={ICON_SIZE.control} className="text-muted" />
		</Link>
	)
}
