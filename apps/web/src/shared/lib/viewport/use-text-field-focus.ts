import { useSyncExternalStore } from 'react'

const NON_TEXT_INPUT_TYPES = new Set([
	'button',
	'checkbox',
	'color',
	'file',
	'hidden',
	'image',
	'radio',
	'range',
	'reset',
	'submit',
])

/** What isTextField reads of an element; structural, so it is testable without a DOM. */
interface FocusTarget {
	tagName: string
	type?: string
	readOnly?: boolean
	isContentEditable?: boolean
}

/** Fields that open the on-screen keyboard: text inputs, textareas, contenteditable. */
export const isTextField = (element: FocusTarget | null): boolean => {
	if (!element) return false
	const tag = element.tagName.toLowerCase()
	if (tag === 'textarea') return element.readOnly !== true
	if (tag === 'input') {
		return element.readOnly !== true && !NON_TEXT_INPUT_TYPES.has(element.type ?? 'text')
	}
	return element.isContentEditable === true
}

const getSnapshot = (): boolean => isTextField(document.activeElement)

const subscribe = (onChange: () => void): (() => void) => {
	document.addEventListener('focusin', onChange)
	document.addEventListener('focusout', onChange)
	return () => {
		document.removeEventListener('focusin', onChange)
		document.removeEventListener('focusout', onChange)
	}
}

/** A text field has focus — on a phone that means the keyboard is up. */
export const useIsTextFieldFocused = (): boolean =>
	useSyncExternalStore(subscribe, getSnapshot, () => false)
