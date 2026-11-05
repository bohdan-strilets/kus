import { cn, formatInteger } from '@/shared/lib'

import { Text } from '../text'
import type { BarChartProps } from './bar-chart.types'
import { barVariants } from './bar-chart.variants'
import { getBarDensity } from './get-bar-density'
import { getBarRatios } from './get-bar-ratios'

/** Tallest bar, in px; the others scale to it (the one dynamic inline style). */
export const BAR_CHART_MAX_BAR_PX = 88

/**
 * Columns of plain HTML on the tokens (mockups/training-stats.html): value above, bar, caption
 * below. Zero is a thin muted stub. Read as one image with `summary`, otherwise from a hidden list.
 */
export const BarChart = ({
	bars,
	summary,
	listLabel,
	tone = 'training',
	hasValues = true,
	className,
}: BarChartProps) => {
	const ratios = getBarRatios(bars.map((bar) => bar.value))
	const { isDense, labelStep } = getBarDensity(bars.length)
	const isValueShown = hasValues && !isDense

	return (
		<div className={className}>
			<div
				role={summary ? 'img' : undefined}
				aria-label={summary}
				aria-hidden={summary ? undefined : true}
			>
				{/* stretched columns share one baseline whatever their value caption */}
				<div className="flex items-stretch gap-1.5">
					{bars.map((bar, index) => {
						const ratio = ratios[index] ?? 0
						return (
							<div
								key={`${index}-${bar.label}`}
								className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
							>
								{isValueShown && !bar.isPending && (
									<Text as="span" variant="small" weight="bold" tone="mutedStrong" isTabular>
										{bar.valueLabel ?? formatInteger(bar.value)}
									</Text>
								)}
								{bar.isPending ? null : ratio === 0 ? (
									<span
										data-bar-stub=""
										className="h-1 w-full max-w-5.5 shrink-0 rounded-checkbox bg-muted-soft/40"
									/>
								) : (
									<span
										className={barVariants({ tone })}
										style={{ height: Math.round(ratio * BAR_CHART_MAX_BAR_PX) }}
									/>
								)}
							</div>
						)
					})}
				</div>
				{/* captions in their own row: a wide one may spill over its empty neighbours, never a bar */}
				<div className="mt-1 flex gap-1.5">
					{bars.map((bar, index) => (
						<div key={`${index}-${bar.label}`} className="flex min-w-0 flex-1 justify-center">
							<Text
								as="span"
								variant="small"
								weight="regular"
								tone="muted"
								className={cn('whitespace-nowrap', index % labelStep !== 0 && 'invisible')}
							>
								{bar.label}
							</Text>
						</div>
					))}
				</div>
			</div>
			{!summary && (
				<ul aria-label={listLabel} className="sr-only">
					{bars.map((bar, index) =>
						bar.isPending ? null : (
							<li key={`${index}-${bar.label}`}>
								{bar.ariaLabel ?? `${bar.label}: ${bar.valueLabel ?? formatInteger(bar.value)}`}
							</li>
						),
					)}
				</ul>
			)}
		</div>
	)
}
