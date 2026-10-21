import { Text } from '@/shared/ui'

import { type StatsTileVariantProps, statsTileVariants } from './stats-tile.variants'

interface StatsTileProps extends StatsTileVariantProps {
	label: string
	value: string
	caption?: string
}

/** Label 12/600, value 17/800, caption 12 — all in the tile's own ink. */
export const StatsTile = ({ tone, label, value, caption }: StatsTileProps) => (
	<div className={statsTileVariants({ tone })}>
		<Text as="span" variant="small">
			{label}
		</Text>
		<Text as="span" variant="stat" tone="ink" isTabular>
			{value}
		</Text>
		{caption && (
			<Text as="span" variant="small" weight="regular">
				{caption}
			</Text>
		)}
	</div>
)
