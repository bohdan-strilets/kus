import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, formatInteger, PRESS, useCountUp } from '@/shared/lib'
import { FoodIcon, Icon, Text } from '@/shared/ui'

import type { FoodEntryView } from '../../model/entry.types'
import { EntryCaption } from './EntryCaption'

export interface EntryItemProps {
	entry: FoodEntryView
	/** Tap on the hint («суха?») opens the clarification. */
	onHintClick?: () => void
	/**
	 * The whole line opens the edit sheet («Сьогодні», the picker in the sheet). The hint is then
	 * plain text: a button inside a button is not allowed.
	 */
	onEdit?: () => void
}

const CHANGE_COUNT_MS = 300
const ESTIMATE_ICON_PX = 20

const ROW_CLASS = 'flex items-center gap-2.5 px-1.5 py-1'

/** One food line in a meal card (mockups/chat.html): food icon, name 14/600, caption, kcal 14/700. */
export const EntryItem = ({ entry, onHintClick, onEdit }: EntryItemProps) => {
	const { t } = useTranslation()
	const isEstimate = entry.isEstimate === true
	// only a change (a recount after a clarification or an edit) animates, not the first show
	const kcalRef = useCountUp<HTMLSpanElement>(entry.kcal, {
		durationMs: CHANGE_COUNT_MS,
		initial: entry.kcal,
		format: formatInteger,
	})
	const content = (
		<>
			{isEstimate ? (
				// «Без деталей» has no dish to draw: the three dots on a secondary tile (chat-day-closed)
				<span
					aria-hidden="true"
					className="flex size-9 shrink-0 items-center justify-center rounded-icon bg-secondary text-muted-strong"
				>
					<Icon name="more" size={ESTIMATE_ICON_PX} />
				</span>
			) : (
				<FoodIcon category={entry.category} />
			)}
			<div className="flex min-w-0 flex-1 flex-col">
				<Text as="span" variant="cardTitle" weight="semibold">
					{entry.name}
				</Text>
				<EntryCaption entry={entry} onHintClick={onEdit ? undefined : onHintClick} />
			</div>
			<Text as="span" variant="cardTitle" isTabular>
				{isEstimate ? (
					t('entry.amountApprox', { amount: formatInteger(entry.kcal) })
				) : (
					<span ref={kcalRef}>{formatInteger(entry.kcal)}</span>
				)}
			</Text>
		</>
	)
	if (!onEdit) return <div className={ROW_CLASS}>{content}</div>
	return (
		<motion.button
			type="button"
			aria-haspopup="dialog"
			onClick={onEdit}
			{...PRESS}
			className={cn(ROW_CLASS, 'w-full cursor-pointer rounded-tile text-left')}
		>
			{content}
		</motion.button>
	)
}
