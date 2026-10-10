import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Icon, type IconName, Text } from '@/shared/ui'

import { PlanCardDecor } from './PlanCardDecor'
import { PLAN_CARD_MACROS, planMacroTileVariants } from './plan-card.variants'

const PACE_ICON_SIZE = 22

export interface PlanCardProps {
	/** «Нові цілі на день» */
	heading: string
	kcal: number
	proteinG: number
	carbsG: number
	fatG: number
	paceText: string
	paceIcon: IconName
	/** Between the macros and the pace row: «Було: …», warnings. */
	children?: ReactNode
}

/** The new daily goals on a warm card: calories, three macros and the pace line. */
export const PlanCard = ({
	heading,
	kcal,
	proteinG,
	carbsG,
	fatG,
	paceText,
	paceIcon,
	children,
}: PlanCardProps) => {
	const { t } = useTranslation()
	const grams = { protein: proteinG, carbs: carbsG, fat: fatG }

	return (
		<div className="relative isolate flex flex-col gap-3 overflow-hidden rounded-chip bg-plan-card p-3.5">
			<PlanCardDecor />
			<div className="flex items-baseline justify-between">
				<Text as="span" variant="caption" weight="bold" tone="primaryDeep">
					{heading}
				</Text>
				<Text as="span" variant="bigNumber" tone="ink">
					{formatInteger(kcal)}{' '}
					<span className="text-body font-bold text-muted-strong">{t('recalcGoals.kcal')}</span>
				</Text>
			</div>
			<div className="grid grid-cols-3 gap-1.5">
				{PLAN_CARD_MACROS.map(({ macro, labelKey, inkClass }) => (
					<div key={macro} className={planMacroTileVariants({ macro })}>
						<Text as="span" variant="small" weight="regular" className={inkClass}>
							{t(labelKey)}
						</Text>
						<Text as="span" variant="body" weight="extrabold" isTabular>
							{t('profile.goals.grams', { value: formatInteger(grams[macro]) })}
						</Text>
					</div>
				))}
			</div>
			{children}
			<div className="flex items-center gap-2.5 rounded-tile-sm bg-surface/75 px-3 py-2.5">
				<Icon name={paceIcon} size={PACE_ICON_SIZE} className="shrink-0 text-primary" />
				<Text as="span" variant="caption" weight="regular">
					{paceText}
				</Text>
			</div>
		</div>
	)
}
