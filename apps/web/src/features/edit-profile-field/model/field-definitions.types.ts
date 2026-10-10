import type { ParseKeys } from 'i18next'

export interface ChoiceOptionDefinition {
	value: string
	labelKey: ParseKeys
}

export interface NumberLimits {
	min: number
	max: number
}

export type FieldDefinition =
	| { kind: 'choice'; options: ChoiceOptionDefinition[] }
	| {
			kind: 'number'
			inputLabelKey: ParseKeys
			unitKey: ParseKeys
			inputMode: 'numeric' | 'decimal'
			isInteger: boolean
			limits: NumberLimits
	  }
	| { kind: 'activity' }
	| { kind: 'pace' }
