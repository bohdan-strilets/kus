import * as RadixSwitch from '@radix-ui/react-switch'
import { motion } from 'motion/react'

import { TRANSITION } from '@/shared/lib'

import { THUMB_TRAVEL_PX } from './switch.constants'

export interface SwitchProps {
	isChecked: boolean
	onCheckedChange: (isChecked: boolean) => void
	/** Accessible name, e.g. «Звуки» — the row's visible label is not linked to the control. */
	label: string
	disabled?: boolean
}

/** docs Toggle: 48×28, off `toggle-off`, on `primary`; the thumb slides with a spring. */
export const Switch = ({ isChecked, onCheckedChange, label, disabled }: SwitchProps) => (
	<RadixSwitch.Root
		checked={isChecked}
		onCheckedChange={onCheckedChange}
		disabled={disabled}
		aria-label={label}
		// 48×28 in the mockup; the ::after hitbox gives the 44px tap target (CLAUDE.md §13)
		className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-toggle-off transition-colors duration-(--duration-base) after:absolute after:-inset-x-1 after:-inset-y-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary"
	>
		<RadixSwitch.Thumb asChild>
			<motion.span
				className="absolute top-0.5 left-0.5 block size-6 rounded-full bg-white shadow-chip"
				initial={false}
				animate={{ x: isChecked ? THUMB_TRAVEL_PX : 0 }}
				transition={TRANSITION.toggle}
			/>
		</RadixSwitch.Thumb>
	</RadixSwitch.Root>
)
