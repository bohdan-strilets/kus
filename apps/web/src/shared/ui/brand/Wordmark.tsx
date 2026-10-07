import { cn } from '@/shared/lib'

import { WORDMARK } from './brand.constants'

export interface WordmarkProps {
	/** Font size in px: 34 under the hamster on login, 30 next to it on registration. */
	size: number
	className?: string
}

/** «kusik», always lowercase, 800 with tight tracking (text-wordmark); size scales with the context. */
export const Wordmark = ({ size, className }: WordmarkProps) => (
	<span className={cn('text-wordmark text-ink', className)} style={{ fontSize: size }}>
		{WORDMARK}
	</span>
)
