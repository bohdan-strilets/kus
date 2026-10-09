import { motion } from 'motion/react'

import { cn, formatInteger, PRESS, TRANSITION } from '@/shared/lib'
import { type FoodCategory, FoodIcon, Icon, ICON_SIZE, Text } from '@/shared/ui'

export interface MealRowProps {
	/** «Сніданок» */
	mealLabel: string
	/** «08:40» */
	time: string
	/** «Яйця, гречка, кава з молоком»; left out when the entries show under the row. */
	summary?: string
	kcal: number
	/** getMealCategory(entries): the most caloric entry picks the icon. */
	category: FoodCategory
	onOpen?: () => void
	/** The row is the header of a list that folds: a chevron and aria-expanded. */
	isExpanded?: boolean
	/** The id of the list it controls; the list is in the DOM only while expanded. */
	controlsId?: string
	className?: string
}

const ROW_CLASS =
	'flex w-full items-center gap-3 rounded-bubble bg-surface/85 py-2.5 pr-3.5 pl-2.5 text-left'
const CHEVRON_EXPANDED_DEG = 180

/**
 * A meal in the «Сьогодні» list (mockups/today.html): 44 food icon, title 15/700 + time, kcal 15/800.
 * Without onOpen it is a plain row, not a button that does nothing.
 */
export const MealRow = ({
	mealLabel,
	time,
	summary,
	kcal,
	category,
	onOpen,
	isExpanded,
	controlsId,
	className,
}: MealRowProps) => {
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
				{summary && (
					<Text as="span" variant="small" weight="regular" tone="muted" className="truncate">
						{summary}
					</Text>
				)}
			</span>
			<Text as="span" weight="extrabold" isTabular>
				{formatInteger(kcal)}
			</Text>
			{isExpanded !== undefined && (
				<motion.span
					aria-hidden="true"
					initial={false}
					animate={{ rotate: isExpanded ? CHEVRON_EXPANDED_DEG : 0 }}
					transition={TRANSITION.base}
					className="flex text-muted"
				>
					<Icon name="chevron-down" size={ICON_SIZE.control} />
				</motion.span>
			)}
		</>
	)
	if (!onOpen) return <div className={cn(ROW_CLASS, className)}>{content}</div>
	return (
		<motion.button
			type="button"
			onClick={onOpen}
			aria-expanded={isExpanded}
			aria-controls={isExpanded ? controlsId : undefined}
			{...PRESS}
			className={cn(ROW_CLASS, 'cursor-pointer', className)}
		>
			{content}
		</motion.button>
	)
}
