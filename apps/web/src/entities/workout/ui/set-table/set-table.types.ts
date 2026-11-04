import type { ReactNode } from 'react'

export interface SetTableProps {
	/** False: a bodyweight exercise, the table has no «Вага» column. */
	hasWeight: boolean
	/** The rows (`SetRow`) and the set being edited (`SetFields`), in the order of the sets. */
	children: ReactNode
}
