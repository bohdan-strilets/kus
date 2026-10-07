import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config'
import { formatInteger } from '@/shared/lib'
import { Text } from '@/shared/ui'

import type { MacroProgress } from '../../model/macro.types'
import { MiniRing } from './MiniRing'

export interface CompactDayBarProps {
	eaten: number
	goal: number
	protein: MacroProgress
}

/**
 * docs CompactBar — the chat header collapsed on scroll (mockups/chat-compact.html):
 * a mini ring, «1 370 / 2 200» and «Б 78/140»; a tap opens «Сьогодні».
 */
export const CompactDayBar = ({ eaten, goal, protein }: CompactDayBarProps) => {
	const { t } = useTranslation()
	const eatenText = formatInteger(eaten)
	const goalText = formatInteger(goal)

	return (
		<Link
			to={ROUTES.today}
			aria-label={t('gauge.compactLabel', {
				eaten: eatenText,
				goal: goalText,
				protein: formatInteger(protein.value),
				proteinGoal: formatInteger(protein.goal),
			})}
			className="flex min-h-tap min-w-0 flex-1 items-center gap-2 rounded-bubble-ai bg-surface/90 px-3 text-ink shadow-chip"
		>
			<MiniRing ratio={goal > 0 ? eaten / goal : 0} />
			<Text as="span" weight="extrabold" isTabular className="whitespace-nowrap">
				{eatenText}{' '}
				<Text as="span" variant="small" tone="muted">
					{t('gauge.ofGoalSlash', { goal: goalText })}
				</Text>
			</Text>
			<span className="ml-auto rounded-badge bg-protein-bg px-2 py-0.75 text-small font-extrabold whitespace-nowrap text-protein-ink">
				{t('macro.proteinShort', {
					value: formatInteger(protein.value),
					goal: formatInteger(protein.goal),
				})}
			</span>
		</Link>
	)
}
