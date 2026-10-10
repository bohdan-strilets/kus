import type { ReactNode } from 'react'

import { Surface } from '../surface'

export interface RowGroupProps {
	children: ReactNode
}

/** A frosted card with dividers between the ListRows inside (profile menu, my-data, settings). */
export const RowGroup = ({ children }: RowGroupProps) => (
	<Surface
		variant="list"
		radius="card"
		shadow="list"
		className="flex flex-col divide-y divide-divider overflow-hidden"
	>
		{children}
	</Surface>
)
