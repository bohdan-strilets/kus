import {
	averageTileLabelVariants,
	type AverageTileVariantProps,
	averageTileVariants,
} from './average-tile.variants'

export type AverageTileProps = Required<AverageTileVariantProps> & {
	label: string
	value: string
}

export const AverageTile = ({ tone, label, value }: AverageTileProps) => (
	<div className={averageTileVariants({ tone })}>
		<span className={averageTileLabelVariants({ tone })}>{label}</span>
		<span className="text-stat text-ink tabular-nums">{value}</span>
	</div>
)
