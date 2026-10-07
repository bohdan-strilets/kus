import { cn } from '@/shared/lib'

import { WORDMARK_GAP_SCALE, WORDMARK_SCALE } from './brand.constants'
import { LogoMark } from './LogoMark'
import { Wordmark } from './Wordmark'

export interface LogoProps {
	size?: number
	className?: string
}

/** Mark + «kusik» wordmark (always lowercase): 0.7 × size, weight 800, tracking −0.04em. */
export const Logo = ({ size = 32, className }: LogoProps) => (
	<span
		className={cn('inline-flex items-center', className)}
		style={{ gap: size * WORDMARK_GAP_SCALE }}
	>
		<LogoMark size={size} isLabelled={false} />
		<Wordmark size={Math.round(size * WORDMARK_SCALE)} />
	</span>
)
