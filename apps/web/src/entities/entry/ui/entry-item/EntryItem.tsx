import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, formatInteger, PRESS } from '@/shared/lib'
import { FoodIcon, Text } from '@/shared/ui'

import type { FoodEntryView } from '../../model/entry.types'

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

const ROW_CLASS = 'flex items-center gap-2.5 px-1.5 py-1'

const EntryCaption = ({ entry, onHintClick }: Pick<EntryItemProps, 'entry' | 'onHintClick'>) => {
	const { t } = useTranslation()
	const { amount, captionState = 'plain', hint } = entry

	if (captionState === 'usual') {
		return (
			<Text as="span" variant="small" tone="primary">
				{t('entry.usual')}
			</Text>
		)
	}

	if (captionState === 'clarifying') {
		return (
			<Text as="span" variant="small" tone="primaryDeep">
				{t('entry.clarifyingCaption', { amount })}
			</Text>
		)
	}

	return (
		<Text as="span" variant="small" weight="regular" tone="muted">
			{amount}
			{captionState === 'hint' && hint && (
				<>
					{' · '}
					{onHintClick ? (
						<button
							type="button"
							aria-expanded={false}
							onClick={onHintClick}
							// the invisible ::after widens the 16px link to a 44px tap area (CLAUDE.md §13)
							className="relative cursor-pointer font-semibold text-primary-deep underline after:absolute after:-inset-x-2 after:-inset-y-3.5"
						>
							{hint}
						</button>
					) : (
						<span className="font-semibold text-primary-deep">{hint}</span>
					)}
				</>
			)}
		</Text>
	)
}

/** One food line in a meal card (mockups/chat.html): food icon, name 14/600, caption, kcal 14/700. */
export const EntryItem = ({ entry, onHintClick, onEdit }: EntryItemProps) => {
	const content = (
		<>
			<FoodIcon category={entry.category} />
			<div className="flex min-w-0 flex-1 flex-col">
				<Text as="span" variant="cardTitle" weight="semibold">
					{entry.name}
				</Text>
				<EntryCaption entry={entry} onHintClick={onEdit ? undefined : onHintClick} />
			</div>
			<Text as="span" variant="cardTitle" isTabular>
				{formatInteger(entry.kcal)}
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
