import type { ReactNode } from 'react'

import { Surface, Text } from '@/shared/ui'

export interface SupportCardProps {
	/** Kusik's line without reproach, e.g. «Понад ціль на 180 — це менше за бутерброд…». */
	message: string
	/**
	 * The 44px hamster head. today-over draws a calm face that isn't among the 8 HamsterHead faces
	 * yet, so the caller passes it in.
	 */
	avatar?: ReactNode
}

/** docs: the `support` card under the meals when over the goal (mockups/today-over.html). */
export const SupportCard = ({ message, avatar }: SupportCardProps) => (
	<Surface
		variant="selected"
		radius="bubble"
		shadow="none"
		className="flex items-center gap-3 py-2.5 pr-3.5 pl-2.5"
	>
		{avatar}
		<Text as="p" variant="caption" weight="regular" tone="mutedStrong" className="flex-1">
			{message}
		</Text>
	</Surface>
)
