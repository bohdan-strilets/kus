import type { ReactNode } from 'react'

/** Wiring the card hands to its control so label, error and screen readers stay linked. */
export interface FormFieldControlProps {
	id: string
	'aria-invalid': boolean
	'aria-describedby': string | undefined
}

export interface FormFieldProps {
	/** Shown inside the card, 12/600 (docs Field). */
	label: string
	/** Already translated, specific message; turns the card red and shakes it. */
	error?: string
	/** Muted 12/600 note under the card («Мінімум 10 символів»); the error replaces it. */
	hint?: string
	/**
	 * Submit attempts (React Hook Form `formState.submitCount`): the card shakes again on every
	 * failed submit, even when the message is the same as last time.
	 */
	attemptCount?: number
	/** e.g. the 44×44 «show password» button on the right. */
	endSlot?: ReactNode
	children: (controlProps: FormFieldControlProps) => ReactNode
	className?: string
}
