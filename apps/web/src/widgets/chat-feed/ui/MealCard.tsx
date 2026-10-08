import type { ClarificationResponse, LoggedMeal } from '@kus/shared'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	ClarifyCard,
	EntryCard,
	EntryItem,
	type FoodEntryView,
	getMealLabelKey,
	toFoodEntryView,
} from '@/entities/entry'
import { useAnswerClarification } from '@/features/answer-clarify'
import { formatTime } from '@/shared/lib'

import type { ClarificationPlacement } from '../lib/get-clarification-placement'
import { getClarifyHint } from '../lib/get-clarify-hint'

interface MealCardProps {
	meal: LoggedMeal
	/** Every question of the reply; each sits under its last entry across all the reply's meals. */
	clarifications: readonly ClarificationResponse[]
	/** Per question, over the whole reply (a day may link entries of several meals). */
	placement: ReadonlyMap<string, ClarificationPlacement>
	/** The newest reply opens its questions; older ones show the «суха?» hint (mockups/chat.html). */
	isLatestReply: boolean
}

const getAnswerLabel = (clarification: ClarificationResponse): string | null => {
	if (clarification.status !== 'ANSWERED' || clarification.answeredOptionIndex === null) return null
	return clarification.options[clarification.answeredOptionIndex]?.label ?? null
}

/** docs MealCard with the food lines of this message and, under a line in doubt, its question. */
const getOpenIds = (clarifications: readonly ClarificationResponse[]): ReadonlySet<string> =>
	new Set(clarifications.filter((item) => item.status === 'OPEN').map((item) => item.id))

export const MealCard = ({ meal, clarifications, placement, isLatestReply }: MealCardProps) => {
	const { t } = useTranslation()
	const { answer, pending } = useAnswerClarification()
	const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(() =>
		isLatestReply ? getOpenIds(clarifications) : new Set(),
	)
	// a newer reply arrived: this one folds back to its «суха?» hints (adjusted during render)
	const [wasLatest, setWasLatest] = useState(isLatestReply)
	if (wasLatest !== isLatestReply) {
		setWasLatest(isLatestReply)
		setOpenedIds(isLatestReply ? getOpenIds(clarifications) : new Set())
	}

	const findClarification = (entryId: string): ClarificationResponse | undefined =>
		clarifications.find((item) => item.entryIds.includes(entryId))
	const getLastEntryId = (clarification: ClarificationResponse): string | undefined =>
		placement.get(clarification.id)?.lastEntryId
	const getLoggedKcal = (clarification: ClarificationResponse): number =>
		placement.get(clarification.id)?.loggedKcal ?? 0

	return (
		<EntryCard
			mealLabel={t(getMealLabelKey(meal.type))}
			time={formatTime(new Date(meal.eatenAt))}
			kcal={meal.totals.kcal}
			macros={meal.totals}
		>
			{meal.entries.map((entry) => {
				const clarification = findClarification(entry.id)
				const isOpen = clarification?.status === 'OPEN'
				const isAskedHere =
					clarification !== undefined && getLastEntryId(clarification) === entry.id
				const hint =
					clarification && isOpen
						? getClarifyHint(clarification, getLoggedKcal(clarification))
						: null
				// without a hint there is nothing to tap, so the question shows at once
				const isExpanded =
					clarification !== undefined &&
					isOpen &&
					(openedIds.has(clarification.id) || hint === null)
				const view: FoodEntryView = toFoodEntryView(
					entry,
					{
						isClarifying: isExpanded,
						answer: clarification ? getAnswerLabel(clarification) : null,
					},
					t,
				)
				const isHinted = isAskedHere && isOpen && !isExpanded && hint !== null

				return (
					<Fragment key={entry.id}>
						<EntryItem
							entry={isHinted ? { ...view, captionState: 'hint', hint } : view}
							onHintClick={() => {
								if (!clarification) return
								setOpenedIds((ids) => new Set(ids).add(clarification.id))
							}}
						/>
						{clarification && isAskedHere && isExpanded && (
							<ClarifyCard
								question={clarification.question}
								options={clarification.options.map((option, index) => ({
									id: String(index),
									label: option.label,
									kcal: option.kcal,
								}))}
								selectedId={
									pending?.clarificationId === clarification.id ? String(pending.optionIndex) : null
								}
								isPending={pending !== null}
								onSelect={(id) => {
									answer({ clarificationId: clarification.id, optionIndex: Number(id) })
								}}
								shouldFocusOnMount={openedIds.has(clarification.id) && !isLatestReply}
							/>
						)}
					</Fragment>
				)
			})}
		</EntryCard>
	)
}
