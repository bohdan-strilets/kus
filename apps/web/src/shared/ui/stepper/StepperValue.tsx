import { useRef, useState } from 'react'

import { ESCAPE_LOCAL_ATTRIBUTE } from '../bottom-sheet'
import { Text } from '../text'
import { parseStepperValue } from './parse-stepper-value'
import type { StepperEdit } from './stepper.types'

interface StepperValueProps {
	label: string
	valueText: string
	unit?: string
	edit?: StepperEdit
}

const VALUE_CLASS = 'text-title tabular-nums'

/** The value of a stepper: text, or (with `edit`) a button that turns into a number input. */
export const StepperValue = ({ label, valueText, unit, edit }: StepperValueProps) => {
	const [isEditing, setIsEditing] = useState(false)
	const [draft, setDraft] = useState('')
	// Enter commits and then the unmounting input blurs: the second pass must do nothing
	const isDoneRef = useRef(false)

	const finish = (shouldApply: boolean) => {
		if (isDoneRef.current || !edit) return
		isDoneRef.current = true
		setIsEditing(false)
		if (!shouldApply) return
		const value = parseStepperValue(draft, edit)
		if (value !== null) edit.onCommit(value)
	}

	const startEditing = () => {
		if (!edit) return
		isDoneRef.current = false
		setDraft(edit.inputValue)
		setIsEditing(true)
	}

	return (
		<span
			aria-live="polite"
			className="flex min-w-16 items-baseline justify-center gap-1 text-center"
		>
			{edit && isEditing ? (
				<input
					aria-label={label}
					{...{ [ESCAPE_LOCAL_ATTRIBUTE]: '' }}
					value={draft}
					inputMode={edit.decimals > 0 ? 'decimal' : 'numeric'}
					autoFocus
					onFocus={(event) => {
						event.currentTarget.select()
					}}
					onChange={(event) => {
						setDraft(event.target.value)
					}}
					onBlur={() => {
						finish(true)
					}}
					onKeyDown={(event) => {
						if (event.key === 'Enter') finish(true)
						if (event.key === 'Escape') finish(false)
					}}
					className={`${VALUE_CLASS} min-h-11 w-16 rounded-icon bg-surface text-center ring-2 ring-primary outline-none`}
				/>
			) : edit ? (
				<button
					type="button"
					aria-label={edit.buttonLabel}
					onClick={startEditing}
					className={`${VALUE_CLASS} min-h-11 min-w-11 cursor-pointer`}
				>
					{valueText}
				</button>
			) : (
				<span className={VALUE_CLASS}>{valueText}</span>
			)}
			{unit && (
				<Text as="span" variant="caption" tone="muted" weight="semibold">
					{unit}
				</Text>
			)}
		</span>
	)
}
