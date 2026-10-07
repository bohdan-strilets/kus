import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Badge, Button, Text } from '@/shared/ui'

import type { MacroAmounts } from '../../model/entry.types'

export interface EntryCardProps {
	/** «Сніданок» */
	mealLabel: string
	/** «08:40» */
	time: string
	kcal: number
	macros: MacroAmounts
	/** EntryItem lines and an open ClarifyCard between them. */
	children: ReactNode
	onEdit?: () => void
}

/**
 * docs MealCard — Kusik's answer to a logged meal, shaped like his bubble (mockups/chat.html):
 * «Сніданок · 08:40» with the kcal badge, the food lines, «Б · В · Ж» and «Редагувати».
 * Macros are always protein → carbs → fat, even though the mockup prints Б · Ж · В.
 */
export const EntryCard = ({ mealLabel, time, kcal, macros, children, onEdit }: EntryCardProps) => {
	const { t } = useTranslation()

	return (
		<article className="overflow-hidden rounded-bubble-ai rounded-bl-tail bg-surface-glass shadow-card">
			<header className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
				<Text as="span" variant="cardTitle">
					{mealLabel}{' '}
					<Text as="span" variant="cardTitle" weight="medium" tone="muted">
						· {time}
					</Text>
				</Text>
				<Badge variant="kcal">{t('entry.kcal', { kcal: formatInteger(kcal) })}</Badge>
			</header>
			<div className="flex flex-col gap-0.5 px-2">{children}</div>
			<footer className="flex items-center justify-between px-3.5 pt-2 pb-3">
				<Text as="span" variant="small" weight="regular" tone="muted" isTabular>
					{t('entry.macroLine', {
						protein: formatInteger(macros.protein),
						carbs: formatInteger(macros.carbs),
						fat: formatInteger(macros.fat),
					})}
				</Text>
				<Button variant="secondary" size="sm" onClick={onEdit}>
					{t('entry.edit')}
				</Button>
			</footer>
		</article>
	)
}
