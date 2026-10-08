import { motion } from 'motion/react'

import { cn, formatInteger, PRESS } from '@/shared/lib'
import { type FoodCategory, FoodIcon, Text } from '@/shared/ui'

export interface MealRowProps {
	/** «Сніданок» */
	mealLabel: string
	/** «08:40» */
	time: string
	/** «Яйця, гречка, кава з молоком» */
	summary: string
	kcal: number
	/** getMealCategory(entries): the most caloric entry picks the icon. */
	category: FoodCategory
	onOpen?: () => void
}

const ROW_CLASS =
	'flex w-full items-center gap-3 rounded-bubble bg-surface/85 py-2.5 pr-3.5 pl-2.5 text-left'

/**
 * A meal in the «Сьогодні» list (mockups/today.html): 44 food icon, title 15/700 + time, kcal 15/800.
 * Without onOpen it is a plain row, not a button that does nothing.
 */
export const MealRow = ({ mealLabel, time, summary, kcal, category, onOpen }: MealRowProps) => {
	const content = (
		<>
			<FoodIcon category={category} size="meal" />
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<Text as="span" weight="bold">
					{mealLabel}{' '}
					<Text as="span" variant="small" weight="medium" tone="muted">
						{time}
					</Text>
				</Text>
				<Text as="span" variant="small" weight="regular" tone="muted" className="truncate">
					{summary}
				</Text>
			</span>
			<Text as="span" weight="extrabold" isTabular>
				{formatInteger(kcal)}
			</Text>
		</>
	)
	if (!onOpen) return <div className={ROW_CLASS}>{content}</div>
	return (
		<motion.button
			type="button"
			onClick={onOpen}
			{...PRESS}
			className={cn(ROW_CLASS, 'cursor-pointer')}
		>
			{content}
		</motion.button>
	)
}
