import { MAX_ENTRY_GRAMS, MIN_ENTRY_GRAMS } from '@kus/shared'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, PRESS } from '@/shared/lib'
import { type FormFieldControlProps, Icon, ICON_SIZE, Input, Text } from '@/shared/ui'

import type { AmountUnit } from '../lib/get-amount-unit'

/** One tap on − / +, in g or ml. */
export const AMOUNT_STEP = 10

export type AmountStepperProps = FormFieldControlProps & {
	value: string
	onChange: (value: string) => void
	onBlur: () => void
	unit: AmountUnit
	/** For the − / + labels: «Менше: Гречка варена». */
	entryName: string
	/** The weight differs from the logged one: primary ring (mockups/chat-edit-entry.html). */
	isChanged: boolean
}

const clamp = (value: number): number => Math.min(MAX_ENTRY_GRAMS, Math.max(MIN_ENTRY_GRAMS, value))

// 36×40 inside the pill; the invisible ::after brings the tap area to 44 (CLAUDE.md §13)
const STEP_BUTTON_CLASS =
	'relative flex h-10 w-9 shrink-0 cursor-pointer items-center justify-center text-ink after:absolute after:-inset-1'

/** − / amount / + as in the mockup: field pill, radius 14; typed digits are allowed too. */
export const AmountStepper = ({
	value,
	onChange,
	onBlur,
	unit,
	entryName,
	isChanged,
	id,
	...controlProps
}: AmountStepperProps) => {
	const { t } = useTranslation()
	const isMl = unit === 'ml'

	const step = (delta: number): void => {
		const current = Number.parseInt(value, 10)
		onChange(String(clamp((Number.isNaN(current) ? 0 : current) + delta)))
	}

	return (
		<div
			className={cn(
				'flex shrink-0 items-center rounded-tile-sm',
				isChanged ? 'bg-primary-selected ring-2 ring-primary ring-inset' : 'bg-field',
			)}
		>
			<motion.button
				type="button"
				aria-label={t('editEntry.less', { name: entryName })}
				onClick={() => {
					step(-AMOUNT_STEP)
				}}
				{...PRESS}
				className={STEP_BUTTON_CLASS}
			>
				<Icon name="minus" size={ICON_SIZE.control} />
			</motion.button>
			<span className="flex min-w-13 items-center justify-center gap-0.5">
				<Input
					id={id}
					value={value}
					onChange={(event) => {
						onChange(event.target.value)
					}}
					onBlur={onBlur}
					inputMode="numeric"
					autoComplete="off"
					aria-label={t(isMl ? 'editEntry.amountMl' : 'editEntry.amountGrams')}
					className="w-11 text-center font-extrabold tabular-nums"
					{...controlProps}
				/>
				<Text as="span" variant="cardTitle" weight="extrabold">
					{t(isMl ? 'editEntry.unitMl' : 'editEntry.unitGrams')}
				</Text>
			</span>
			<motion.button
				type="button"
				aria-label={t('editEntry.more', { name: entryName })}
				onClick={() => {
					step(AMOUNT_STEP)
				}}
				{...PRESS}
				className={STEP_BUTTON_CLASS}
			>
				<Icon name="plus" size={ICON_SIZE.control} />
			</motion.button>
		</div>
	)
}
