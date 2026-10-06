import './hamster.css'

import { cn } from '@/shared/lib'

import { HAMSTER_COLORS as C } from './hamster.constants'
import type { HamsterHeadProps } from './hamster.types'
import { HEAD_FACES } from './head-faces'

/**
 * Kusik's avatar next to his chat replies (viewBox 0 0 100 100). Always decorative: text is next
 * to it.
 */
export const HamsterHead = ({ mood = 'smile', size = 34, className }: HamsterHeadProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 100 100"
		aria-hidden="true"
		className={cn('k-hamster-head shrink-0', className)}
		data-mood={mood}
	>
		<circle cx="27" cy="24" r="10" fill={C.furDark} />
		<circle cx="27" cy="25" r="5.5" fill={C.earInner} />
		<circle cx="73" cy="24" r="10" fill={C.furDark} />
		<circle cx="73" cy="25" r="5.5" fill={C.earInner} />
		<ellipse cx="50" cy="56" rx="41" ry="38" fill={C.fur} />
		<circle cx="22" cy="64" r="13" fill={C.cheek} />
		<circle cx="78" cy="64" r="13" fill={C.cheek} />
		<ellipse cx="50" cy="72" rx="25" ry="20" fill={C.belly} />
		<ellipse cx="24" cy="61" rx="6" ry="3.5" fill={C.blush} opacity="0.55" />
		<ellipse cx="76" cy="61" rx="6" ry="3.5" fill={C.blush} opacity="0.55" />
		<ellipse cx="50" cy="58" rx="3.6" ry="2.6" fill={C.nose} />
		{HEAD_FACES[mood]}
	</svg>
)
