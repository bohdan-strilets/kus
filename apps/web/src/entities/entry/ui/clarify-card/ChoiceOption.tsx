import { motion } from 'motion/react'

import { cn, PRESS } from '@/shared/lib'
import { Text } from '@/shared/ui'

export interface ChoiceOptionProps {
	label: string
	/** «110 ккал», already formatted. */
	detail: string
	isSelected: boolean
	onSelect: () => void
}

/**
 * An answer in a clarification (mockups/chat-clarify.html): 52 tall, radius 14; the chosen one has a
 * 2px primary border on primary-selected, the other is white.
 */
export const ChoiceOption = ({ label, detail, isSelected, onSelect }: ChoiceOptionProps) => (
	<motion.button
		type="button"
		aria-pressed={isSelected}
		onClick={onSelect}
		{...PRESS}
		className={cn(
			'flex min-h-13 cursor-pointer flex-col items-center justify-center rounded-tile-sm border-2 transition-colors duration-(--duration-base)',
			isSelected ? 'border-primary bg-primary-selected' : 'border-transparent bg-surface',
		)}
	>
		<Text as="span" variant="cardTitle">
			{label}
		</Text>
		<Text as="span" variant="small" weight="regular" tone={isSelected ? 'primaryDeep' : 'muted'}>
			{detail}
		</Text>
	</motion.button>
)
