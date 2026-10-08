import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClarifyCard, EntryCard, EntryItem } from '@/entities/entry'

import { SEED_BREAKFAST, SEED_CLARIFY } from '../../model/seed'
import { useSeedEntries } from '../../model/use-seed-entries'

const CLARIFY_OPTION_IDS = { boiled: 'boiled', dry: 'dry' } as const

interface BreakfastCardProps {
	/** Start with the buckwheat question open (mockups/chat-clarify.html). */
	isClarifyOpen?: boolean
}

/** The seed breakfast card; tapping «суха?» opens the clarification under the buckwheat line. */
export const BreakfastCard = ({ isClarifyOpen = false }: BreakfastCardProps) => {
	const { t } = useTranslation()
	const { eggs, buckwheat, coffee } = useSeedEntries()
	const [isOpen, setIsOpen] = useState(isClarifyOpen)
	const [selectedId, setSelectedId] = useState<string>(CLARIFY_OPTION_IDS.boiled)
	const [isRemembered, setIsRemembered] = useState(true)

	return (
		<EntryCard
			mealLabel={t('meal.breakfast')}
			time={SEED_BREAKFAST.time}
			kcal={SEED_BREAKFAST.kcal}
			macros={SEED_BREAKFAST.macros}
			onEdit={() => undefined}
		>
			<EntryItem entry={eggs} />
			<EntryItem
				entry={isOpen ? { ...buckwheat, captionState: 'clarifying' } : buckwheat}
				onHintClick={() => {
					setIsOpen(true)
				}}
			/>
			{isOpen && (
				<ClarifyCard
					question={t('devUi.seed.clarifyQuestion')}
					options={[
						{
							id: CLARIFY_OPTION_IDS.boiled,
							label: t('devUi.seed.clarifyBoiled'),
							kcal: SEED_CLARIFY.boiledKcal,
						},
						{
							id: CLARIFY_OPTION_IDS.dry,
							label: t('devUi.seed.clarifyDry'),
							kcal: SEED_CLARIFY.dryKcal,
						},
					]}
					selectedId={selectedId}
					onSelect={setSelectedId}
					remember={{
						productName: t('devUi.seed.clarifyProduct'),
						isRemembered,
						onChange: setIsRemembered,
					}}
					shouldFocusOnMount={!isClarifyOpen}
				/>
			)}
			<EntryItem entry={coffee} />
		</EntryCard>
	)
}
