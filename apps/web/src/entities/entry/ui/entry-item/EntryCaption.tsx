import { useTranslation } from 'react-i18next'

import { Text } from '@/shared/ui'

import type { FoodEntryView } from '../../model/entry.types'

interface EntryCaptionProps {
	entry: FoodEntryView
	/** Tap on the hint («суха?») opens the clarification. */
	onHintClick?: () => void
}

/** «250 мл · як завжди» / «1 шт · 50 г · як учора»: the amount, then the mark in primary 12/600. */
const MarkedCaption = ({ amount, mark }: { amount: string; mark: string }) => (
	<Text as="span" variant="small" weight="regular" tone="muted">
		{amount}
		{' · '}
		<Text as="span" variant="small" tone="primary">
			{mark}
		</Text>
	</Text>
)

/** The second line of a food row, by the caption state (mockups/chat.html, chat-as-yesterday.html). */
export const EntryCaption = ({ entry, onHintClick }: EntryCaptionProps) => {
	const { t } = useTranslation()
	const { amount, captionState = 'plain', hint, copiedLabel } = entry

	if (captionState === 'usual') return <MarkedCaption amount={amount} mark={t('entry.usual')} />
	if (captionState === 'copied' && copiedLabel) {
		return <MarkedCaption amount={amount} mark={copiedLabel} />
	}
	if (captionState === 'estimate') {
		return (
			<Text as="span" variant="small" weight="regular" tone="muted">
				{t('entry.estimateCaption')}
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
