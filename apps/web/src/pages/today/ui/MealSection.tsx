import type { LoggedMeal } from '@kus/shared'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import {
	EntryItem,
	getMealCategory,
	getMealLabelKey,
	MealRow,
	toFoodEntryView,
} from '@/entities/entry'
import { expandVariants, formatInteger, formatTime, TRANSITION } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

import { getMealSummary } from '../lib/get-meal-summary'

interface MealSectionProps {
	meal: LoggedMeal
	isExpanded: boolean
	onToggle: () => void
	onEditEntry: (entryId: string) => void
}

/**
 * A meal on «Сьогодні»: the docs MealRow as a header (its summary only while folded), under it
 * the food lines of the chat card and the meal's «Б · В · Ж». A tap on a line opens the edit sheet.
 */
export const MealSection = ({ meal, isExpanded, onToggle, onEditEntry }: MealSectionProps) => {
	const { t } = useTranslation()
	const bodyId = useId()
	// MotionConfig reducedMotion only skips transforms; a height animation has to be skipped here
	const shouldReduceMotion = useReducedMotion()

	return (
		<Surface variant="frosted" radius="bubble" shadow="none" className="flex flex-col">
			<MealRow
				mealLabel={t(getMealLabelKey(meal.type))}
				time={formatTime(new Date(meal.eatenAt))}
				summary={isExpanded ? undefined : getMealSummary(meal.entries)}
				kcal={meal.totals.kcal}
				category={getMealCategory(meal.entries)}
				onOpen={onToggle}
				isExpanded={isExpanded}
				controlsId={bodyId}
				className="bg-transparent"
			/>
			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						key="body"
						id={bodyId}
						variants={expandVariants}
						initial="hidden"
						animate="visible"
						exit="hidden"
						transition={shouldReduceMotion ? { duration: 0 } : TRANSITION.expand}
						className="overflow-hidden"
					>
						<div className="flex flex-col gap-0.5 px-2">
							{meal.entries.map((entry) => (
								<EntryItem
									key={entry.id}
									entry={toFoodEntryView(entry, { isClarifying: false, answer: null }, t)}
									onEdit={() => {
										onEditEntry(entry.id)
									}}
								/>
							))}
						</div>
						<Text
							as="p"
							variant="small"
							weight="regular"
							tone="muted"
							isTabular
							className="px-3.5 pt-1.5 pb-3"
						>
							{t('entry.macroLine', {
								protein: formatInteger(meal.totals.protein),
								carbs: formatInteger(meal.totals.carbs),
								fat: formatInteger(meal.totals.fat),
							})}
						</Text>
					</motion.div>
				)}
			</AnimatePresence>
		</Surface>
	)
}
