import { cn } from '@/shared/lib'

import { MACRO_ORDER, type MacroProgressSet } from '../../model/macro.types'
import { MacroTile } from '../macro-tile/MacroTile'

export interface MacroTilesProps {
	macros: MacroProgressSet
	variant?: 'compact' | 'bar'
	className?: string
}

/** The three macros in one row, always Б → В → Ж. */
export const MacroTiles = ({ macros, variant = 'bar', className }: MacroTilesProps) => (
	<div className={cn('grid grid-cols-3', variant === 'compact' ? 'gap-1.5' : 'gap-2', className)}>
		{MACRO_ORDER.map((macro, index) => (
			<MacroTile
				key={macro}
				macro={macro}
				progress={macros[macro]}
				variant={variant}
				index={index}
			/>
		))}
	</div>
)
