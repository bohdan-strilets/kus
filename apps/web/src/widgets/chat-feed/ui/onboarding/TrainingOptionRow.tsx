import { motion } from 'motion/react'

import { cn, PRESS } from '@/shared/lib'
import { Text } from '@/shared/ui'

interface TrainingOptionRowProps {
	label: string
	hint: string
	isSelected: boolean
	isDisabled: boolean
	onSelect: () => void
}

/** An answer with a hint under it (mockups/training-onboarding.html, «Який досвід?»): 56 tall, one tap sends it. */
export const TrainingOptionRow = ({
	label,
	hint,
	isSelected,
	isDisabled,
	onSelect,
}: TrainingOptionRowProps) => (
	<motion.button
		type="button"
		aria-pressed={isSelected}
		disabled={isDisabled}
		onClick={onSelect}
		className={cn(
			'flex min-h-14 w-full cursor-pointer flex-col justify-center rounded-tile border-2 px-3.5 py-1.5 text-left transition-colors duration-(--duration-base) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink',
			isSelected ? 'border-primary bg-primary-selected' : 'border-transparent bg-field',
		)}
		{...(isDisabled ? {} : PRESS)}
	>
		<Text as="span" variant="body" weight="bold">
			{label}
		</Text>
		<Text as="span" variant="small" tone="mutedStrong" weight="regular">
			{hint}
		</Text>
	</motion.button>
)
