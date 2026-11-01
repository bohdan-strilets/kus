import { Icon, Text } from '@/shared/ui'

import { type StatTileVariantProps, statTileVariants } from './stat-tile.variants'

const RECORD_ICON_SIZE = 13

interface StatTileProps extends StatTileVariantProps {
	label: string
	value: string
	note?: string | null
	/** Spoken addition to a value that is a dash. */
	srNote?: string
	/** A record tile: a trophy beside the label (the label already says it, so the icon is decoration). */
	isRecord?: boolean
}

/** A number tile under the period row: white in the overview, on the cardio colour in «Кардіо». */
export const StatTile = ({
	label,
	value,
	note = null,
	srNote,
	tone,
	isRecord = false,
}: StatTileProps) => (
	<div className={statTileVariants({ tone })}>
		<span className="flex items-center gap-1">
			<Text as="span" variant="small" tone={tone === 'cardio' ? 'ink' : 'muted'}>
				{label}
			</Text>
			{isRecord && <Icon name="trophy" size={RECORD_ICON_SIZE} className="text-success-ink" />}
		</span>
		<Text as="span" variant="stat" tone={isRecord ? 'successInk' : undefined}>
			{value}
			{srNote && <span className="sr-only">{srNote}</span>}
		</Text>
		{note !== null && (
			<Text as="span" variant="small" tone="mutedStrong" isTabular>
				{note}
			</Text>
		)}
	</div>
)
