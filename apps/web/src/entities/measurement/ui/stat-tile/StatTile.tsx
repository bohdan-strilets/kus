import {
	statTileLabelVariants,
	type StatTileVariantProps,
	statTileVariants,
} from './stat-tile.variants'

export type StatTileProps = StatTileVariantProps & {
	label: string
	value: string
}

export const StatTile = ({ tone, label, value }: StatTileProps) => (
	<div className={statTileVariants({ tone })}>
		<span className={statTileLabelVariants({ tone })}>{label}</span>
		<span className="text-name text-ink tabular-nums">{value}</span>
	</div>
)
