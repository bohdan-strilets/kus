import { cn } from '@/shared/lib'

import { METER_MIN_FILL_CLASS, meterFillVariants, meterTrackVariants } from './meter-bar.variants'

export interface MeterBarProps {
	/** Share of the inner width, clamped to 0–100. */
	percent: number
	/** Fill colour class, e.g. `bg-success`. */
	fillClassName: string
	className?: string
}

const clampPercent = (percent: number): number =>
	Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0

/** A decorative horizontal meter: the value is always written next to it as text. */
export const MeterBar = ({ percent, fillClassName, className }: MeterBarProps) => {
	const clamped = clampPercent(percent)

	return (
		<span aria-hidden="true" className={cn(meterTrackVariants(), className)}>
			{clamped > 0 && (
				<span
					className={cn(meterFillVariants(), METER_MIN_FILL_CLASS, fillClassName)}
					style={{ width: `${clamped}%` }}
				/>
			)}
		</span>
	)
}
