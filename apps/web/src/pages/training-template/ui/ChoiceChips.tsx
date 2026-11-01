import { useId } from 'react'

import { Chip, Text } from '@/shared/ui'

interface ChoiceChipsProps {
	label: string
	options: readonly { value: number; text: string }[]
	selected: number | null
	onSelect: (value: number) => void
}

/** A captioned row of one-of-N chips: «Крок прогресу», «Відпочинок». */
export const ChoiceChips = ({ label, options, selected, onSelect }: ChoiceChipsProps) => {
	const labelId = useId()
	return (
		<div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
			<Text as="span" id={labelId} variant="small" tone="muted" weight="semibold">
				{label}
			</Text>
			<div className="flex flex-wrap gap-1.5">
				{options.map(({ value, text }) => (
					<Chip
						key={value}
						variant="choice"
						isSelected={value === selected}
						onClick={() => {
							onSelect(value)
						}}
					>
						{text}
					</Chip>
				))}
			</div>
		</div>
	)
}
