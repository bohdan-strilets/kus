import { motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, formatInteger, ROW_STAGGER_S, useCountUp } from '@/shared/lib'
import { Badge, Button, Text } from '@/shared/ui'

import type { MacroAmounts } from '../../model/entry.types'

export interface EntryCardProps {
	/** «Сніданок» */
	mealLabel: string
	/** «08:40»; none on a card of another day — the plate over it names the day instead. */
	time?: string
	/** «Вчора, 17.10» — a plate over the header when the meal is not about today. */
	dayLabel?: string
	kcal: number
	macros: MacroAmounts
	/** EntryItem lines and an open ClarifyCard between them. */
	children: ReactNode
	onEdit?: () => void
	/** Right next to Kusik's head (no words above it): the bubble tail at the bottom left. */
	hasTail?: boolean
	/** A small muted line under the macros: «Вечеря разом: 917 ккал». */
	footnote?: string
	/** A mark in the top right corner (the «logged» badge); lives outside the clipped card. */
	badge?: ReactNode
	/** A fresh card: the lines cascade in and the kcal counts up from 0. */
	isRevealing?: boolean
	/** The meal holds the «Без деталей» estimate: «≈ 300 ккал» and «Б ≈ 8 · В ≈ 35 · Ж ≈ 14». */
	isApprox?: boolean
}

const REVEAL_COUNT_MS = 500
const CHANGE_COUNT_MS = 300

/**
 * docs MealCard — Kusik's answer to a logged meal: solid `surface`, radius 24; next to his head it
 * takes the bubble tail (mockups/chat.html), under his words it is an attachment without one:
 * «Сніданок · 08:40» with the kcal badge, the food lines, «Б · В · Ж» and «Редагувати».
 * Macros are always protein → carbs → fat, even though the mockup prints Б · Ж · В.
 */
export const EntryCard = ({
	mealLabel,
	time,
	dayLabel,
	kcal,
	macros,
	children,
	onEdit,
	hasTail = true,
	footnote,
	badge,
	isRevealing = false,
	isApprox = false,
}: EntryCardProps) => {
	const { t } = useTranslation()
	const shouldReduceMotion = useReducedMotion()
	// a stable format: a new function would restart the count on every render
	const formatKcal = useCallback(
		(value: number) =>
			t(isApprox ? 'entry.kcalApprox' : 'entry.kcal', { kcal: formatInteger(value) }),
		[t, isApprox],
	)
	const kcalRef = useCountUp<HTMLSpanElement>(kcal, {
		durationMs: isRevealing ? REVEAL_COUNT_MS : CHANGE_COUNT_MS,
		initial: isRevealing ? 0 : kcal,
		format: formatKcal,
	})

	return (
		<div className="relative">
			<article
				className={cn(
					'overflow-hidden bg-surface shadow-card',
					hasTail ? 'rounded-bubble-ai rounded-bl-tail' : 'rounded-card',
				)}
			>
				{dayLabel && (
					<div className="flex px-3.5 pt-3">
						<Badge variant="date">{dayLabel}</Badge>
					</div>
				)}
				<header
					className={cn(
						'flex items-center justify-between px-3.5 pb-1.5',
						dayLabel ? 'pt-2' : 'pt-3',
					)}
				>
					<Text as="span" variant="cardTitle">
						{mealLabel}{' '}
						{time && (
							<Text as="span" variant="cardTitle" weight="medium" tone="muted">
								· {time}
							</Text>
						)}
					</Text>
					<Badge variant="kcal">
						<span ref={kcalRef}>{formatKcal(kcal)}</span>
					</Badge>
				</header>
				<motion.div
					className="flex flex-col gap-0.5 px-2"
					initial={isRevealing && !shouldReduceMotion ? 'hidden' : false}
					animate="visible"
					transition={{ staggerChildren: ROW_STAGGER_S }}
				>
					{children}
				</motion.div>
				<footer className="flex items-center justify-between px-3.5 pt-2 pb-3">
					<Text as="span" variant="small" weight="regular" tone="muted" isTabular>
						{t(isApprox ? 'entry.macroLineApprox' : 'entry.macroLine', {
							protein: formatInteger(macros.protein),
							carbs: formatInteger(macros.carbs),
							fat: formatInteger(macros.fat),
						})}
					</Text>
					{/* only with a handler: a button that does nothing is worse than none */}
					{onEdit && (
						<Button variant="secondary" size="sm" onClick={onEdit}>
							{t('entry.edit')}
						</Button>
					)}
				</footer>
				{footnote && (
					<Text as="p" variant="caption" tone="muted" isTabular className="-mt-1.5 px-3.5 pb-3">
						{footnote}
					</Text>
				)}
			</article>
			{badge}
		</div>
	)
}
