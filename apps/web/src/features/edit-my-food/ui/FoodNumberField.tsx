import { type Control, Controller } from 'react-hook-form'

import { limitDecimals } from '@/shared/lib'
import { NumberField } from '@/shared/ui'

import type { EditMyFoodInput, EditMyFoodValues } from '../model/edit-my-food.schema'

const MAX_DECIMALS = 2

interface FoodNumberFieldProps {
	control: Control<EditMyFoodInput, unknown, EditMyFoodValues>
	name: Exclude<keyof EditMyFoodInput, 'name'>
	label: string
	unit: string
	attemptCount: number
}

/** One tile of the sheet (mockups/memory-products.html): a label, a number and its unit on the `field` tile. */
export const FoodNumberField = ({
	control,
	name,
	label,
	unit,
	attemptCount,
}: FoodNumberFieldProps) => (
	<Controller
		control={control}
		name={name}
		render={({ field, fieldState }) => (
			<NumberField
				size="sm"
				label={label}
				unit={unit}
				inputMode="decimal"
				value={field.value}
				onChange={(text) => {
					field.onChange(limitDecimals(text, MAX_DECIMALS))
				}}
				onBlur={field.onBlur}
				name={field.name}
				error={fieldState.error?.message}
				attemptCount={attemptCount}
				className="bg-field text-ink"
			/>
		)}
	/>
)
