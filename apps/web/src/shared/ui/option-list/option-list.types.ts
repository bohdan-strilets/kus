import type { IconName } from '../icon'

export interface Option<T extends string> {
	value: T
	label: string
	/** 12px muted line under the label. */
	hint?: string
	/** A 40px tile with this icon before the label. */
	icon?: IconName
}

export interface OptionListProps<T extends string> {
	/** null — nothing chosen yet. */
	value: T | null
	onChange: (value: T) => void
	options: Option<T>[]
	/** Accessible name of the group, e.g. «Стать». */
	label: string
}
