import * as RadixCheckbox from '@radix-ui/react-checkbox'
import type { ComponentProps } from 'react'

import { Icon } from '../icon'
import { checkboxVariants } from './checkbox.variants'

const CHECK_ICON_SIZE = 16

export type CheckboxProps = Omit<
	ComponentProps<typeof RadixCheckbox.Root>,
	'checked' | 'onCheckedChange' | 'className' | 'children'
> & {
	isChecked: boolean
	onCheckedChange: (isChecked: boolean) => void
}

/**
 * The 22px checkbox of the consent card and the «Що запам'ятати?» sheet. Give it a label around it
 * (the tap target is the whole row) or `aria-labelledby`; Radix supplies the keyboard and aria-checked.
 */
export const Checkbox = ({ isChecked, onCheckedChange, ...props }: CheckboxProps) => (
	<RadixCheckbox.Root
		{...props}
		checked={isChecked}
		onCheckedChange={(state) => {
			onCheckedChange(state === true)
		}}
		className={checkboxVariants({ isChecked })}
	>
		<RadixCheckbox.Indicator>
			<Icon name="check" size={CHECK_ICON_SIZE} />
		</RadixCheckbox.Indicator>
	</RadixCheckbox.Root>
)
