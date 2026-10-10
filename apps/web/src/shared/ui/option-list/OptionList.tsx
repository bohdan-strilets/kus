import * as RadioGroup from '@radix-ui/react-radio-group'
import { motion } from 'motion/react'

import { cn, PRESS } from '@/shared/lib'

import { Icon } from '../icon'
import { Text } from '../text'
import { CHECK_ICON_SIZE, OPTION_ICON_SIZE } from './option-list.constants'
import type { OptionListProps } from './option-list.types'

/**
 * A single-choice list of big options (gender, activity, pace): Radix RadioGroup, so arrow keys
 * move the choice. The selected one gets a primary border, a tint and a check. An option may
 * carry an icon tile and a hint under the label.
 */
export const OptionList = <T extends string>({
	value,
	onChange,
	options,
	label,
}: OptionListProps<T>) => (
	<RadioGroup.Root
		value={value ?? ''}
		onValueChange={(next) => {
			const picked = options.find((option) => option.value === next)
			if (picked) onChange(picked.value)
		}}
		aria-label={label}
		className="flex flex-col gap-2"
	>
		{options.map((option) => (
			<RadioGroup.Item key={option.value} value={option.value} asChild>
				<motion.button
					type="button"
					className={cn(
						'group flex min-h-14 cursor-pointer items-center gap-3 rounded-tile border-2 border-transparent bg-field px-3.5 py-2 text-left text-ink transition-colors duration-(--duration-base) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink data-[state=checked]:border-primary data-[state=checked]:bg-primary-selected',
						option.icon && 'py-1.5 pr-3.5 pl-1.5',
					)}
					{...PRESS}
				>
					{option.icon && (
						<span className="flex size-10 shrink-0 items-center justify-center rounded-icon bg-surface text-muted-strong transition-colors duration-(--duration-base) group-data-[state=checked]:text-primary">
							<Icon name={option.icon} size={OPTION_ICON_SIZE} />
						</span>
					)}
					<span className="flex min-w-0 flex-1 flex-col">
						<Text as="span" variant="body" weight="bold">
							{option.label}
						</Text>
						{option.hint && (
							<Text as="span" variant="small" weight="regular" tone="mutedStrong">
								{option.hint}
							</Text>
						)}
					</span>
					<RadioGroup.Indicator asChild>
						<Icon name="check" size={CHECK_ICON_SIZE} className="text-primary" />
					</RadioGroup.Indicator>
				</motion.button>
			</RadioGroup.Item>
		))}
	</RadioGroup.Root>
)
