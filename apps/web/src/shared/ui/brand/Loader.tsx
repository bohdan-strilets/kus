import './brand.css'

import { cn, useSvgId } from '@/shared/lib'

import { CRUMBS_BASE_SIZE, CRUMBS_MIN_SIZE } from './brand.constants'
import { BiteMask, BittenCircle, LogoGradient } from './brand-svg'

export interface LoaderProps {
	/** 120 screen · 64 · 32 · 28 in a card · 20 in a button */
	size?: number
	tone?: 'brand' | 'onPrimary'
	/** Screen reader text: t('common.loading'). */
	ariaLabel: string
	/** Visible caption under a full-screen loader, already translated. */
	label?: string
	className?: string
}

/**
 * The bitten gingerbread spins, crumbs fall from the bite. No letter.
 * This is the project's Spinner: for short actions and the first start, shown only after 300 ms
 * (useDelayedFlag). For content with a known shape use Skeleton.
 */
export const Loader = ({ size = 32, tone = 'brand', ariaLabel, label, className }: LoaderProps) => {
	const gradientId = useSvgId('ldg')
	const maskId = useSvgId('ldm')
	const hasCrumbs = size >= CRUMBS_MIN_SIZE && tone === 'brand'
	const scale = size / CRUMBS_BASE_SIZE

	const mark = (
		<span
			role="img"
			aria-label={ariaLabel}
			className="k-loader"
			style={{ width: size, height: size }}
		>
			<svg
				className="k-loader-spin"
				width={size}
				height={size}
				viewBox="0 0 100 100"
				aria-hidden="true"
			>
				<defs>
					{tone === 'brand' && <LogoGradient id={gradientId} />}
					<BiteMask id={maskId} />
				</defs>
				<BittenCircle
					fill={tone === 'brand' ? `url(#${gradientId})` : 'var(--color-white)'}
					maskId={maskId}
				/>
			</svg>
			{hasCrumbs && (
				<>
					<span
						className="k-loader-crumb"
						style={{ right: -2 * scale, top: 24 * scale, width: 8 * scale, height: 8 * scale }}
					/>
					<span
						className="k-loader-crumb k-loader-crumb-2"
						style={{ right: 10 * scale, top: 12 * scale, width: 6 * scale, height: 6 * scale }}
					/>
				</>
			)}
		</span>
	)

	if (!label) return <span className={className}>{mark}</span>

	return (
		<div className={cn('k-loader-block', className)} aria-live="polite">
			{mark}
			<span className="k-loader-label">{label}</span>
		</div>
	)
}
