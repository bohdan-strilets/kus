import './loader.css'

import { useTranslation } from 'react-i18next'

import { cn, useSvgId } from '@/shared/lib'

import { BiteMask, LogoGradient } from '../logo'

export interface LoaderProps {
	/** 120 screen · 64 · 32 · 28 in a card · 20 in a button */
	size?: number
	tone?: 'brand' | 'onPrimary'
	/** Visible caption under a full-screen loader. */
	label?: string
	className?: string
}

/** Crumbs only from this size up (design/src/brand/Loader.tsx). */
const MIN_CRUMBS_SIZE = 64
/** Crumb positions are drawn for a 120px loader and scale from it. */
const CRUMB_BASE_SIZE = 120
// illustration colours, not UI tokens (CLAUDE-design §1 exception)
const CRUMB_COLOR = '#E58A45'
const CRUMB_LATE_COLOR = '#F7C59A'

/**
 * The bitten gingerbread spins, crumbs fall from the bite. No letter (design decision).
 * Show it only after a 300 ms wait — use `Spinner` or `useDelayedFlag`.
 */
export const Loader = ({ size = 32, tone = 'brand', label, className }: LoaderProps) => {
	const { t } = useTranslation()
	const gradientId = useSvgId('ldg')
	const maskId = useSvgId('ldm')
	const hasCrumbs = size >= MIN_CRUMBS_SIZE && tone === 'brand'
	const scale = size / CRUMB_BASE_SIZE

	const mark = (
		<span
			role="img"
			aria-label={t('common.loading')}
			className="relative inline-block flex-none"
			style={{ width: size, height: size }}
		>
			<svg
				className="k-loader-spin block"
				width={size}
				height={size}
				viewBox="0 0 100 100"
				aria-hidden="true"
			>
				<defs>
					{tone === 'brand' && <LogoGradient id={gradientId} />}
					<BiteMask id={maskId} />
				</defs>
				<circle
					cx="50"
					cy="50"
					r="42"
					fill={tone === 'brand' ? `url(#${gradientId})` : 'var(--color-white)'}
					mask={`url(#${maskId})`}
				/>
			</svg>
			{hasCrumbs && (
				<>
					<span
						className="k-loader-crumb"
						style={{
							right: -2 * scale,
							top: 24 * scale,
							width: 8 * scale,
							height: 8 * scale,
							background: CRUMB_COLOR,
						}}
					/>
					<span
						className="k-loader-crumb k-loader-crumb-late"
						style={{
							right: 10 * scale,
							top: 12 * scale,
							width: 6 * scale,
							height: 6 * scale,
							background: CRUMB_LATE_COLOR,
						}}
					/>
				</>
			)}
		</span>
	)

	if (!label) return <span className={cn('inline-flex', className)}>{mark}</span>

	return (
		<div
			className={cn('flex flex-col items-center justify-center gap-4', className)}
			aria-live="polite"
		>
			{mark}
			<span className="text-body font-bold text-muted-strong">{label}</span>
		</div>
	)
}
