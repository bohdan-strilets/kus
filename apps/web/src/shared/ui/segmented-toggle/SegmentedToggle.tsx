import { cn } from '@/shared/lib'

import type { SegmentedToggleProps } from './segmented-toggle.types'
import { segmentedToggleItemVariants, segmentedToggleVariants } from './segmented-toggle.variants'

/**
 * A segmented control of buttons (role=group + aria-pressed), the selected one a dark pill:
 * mockups/progress.html «Період», training stats period and «Вага / Повтори».
 */
export const SegmentedToggle = <T extends string | number>({
	options,
	value,
	onChange,
	size = 'compact',
	className,
	'aria-label': ariaLabel,
}: SegmentedToggleProps<T>) => (
	<div
		role="group"
		aria-label={ariaLabel}
		className={cn(segmentedToggleVariants({ size }), className)}
	>
		{options.map((option) => (
			<button
				key={option.value}
				type="button"
				aria-pressed={option.value === value}
				aria-label={option.ariaLabel}
				onClick={() => {
					onChange(option.value)
				}}
				className={segmentedToggleItemVariants({ size, isSelected: option.value === value })}
			>
				{option.label}
			</button>
		))}
	</div>
)
