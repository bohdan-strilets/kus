import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { FoodIcon, Text } from '@/shared/ui'

import type { FoodEntryView } from '../../model/entry.types'

export interface EntryItemProps {
	entry: FoodEntryView
	/** Tap on the hint («суха?») opens the clarification. */
	onHintClick?: () => void
}

const EntryCaption = ({ entry, onHintClick }: EntryItemProps) => {
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
					<button
						type="button"
						aria-expanded={false}
						onClick={onHintClick}
						// the invisible ::after widens the 16px link to a 44px tap area (CLAUDE.md §13)
						className="relative cursor-pointer font-semibold text-primary-deep underline after:absolute after:-inset-x-2 after:-inset-y-3.5"
					>
						{hint}
					</button>
				</>
			)}
		</Text>
	)
}

/** One food line in a meal card (mockups/chat.html): pictogram, name 14/600, caption, kcal 14/700. */
export const EntryItem = ({ entry, onHintClick }: EntryItemProps) => (
	<div className="flex items-center gap-2.5 px-1.5 py-1">
		<FoodIcon kind={entry.icon} />
		<div className="flex min-w-0 flex-1 flex-col">
			<Text as="span" variant="cardTitle" weight="semibold">
				{entry.name}
			</Text>
			<EntryCaption entry={entry} onHintClick={onHintClick} />
		</div>
		<Text as="span" variant="cardTitle" isTabular>
			{formatInteger(entry.kcal)}
		</Text>
	</div>
)
