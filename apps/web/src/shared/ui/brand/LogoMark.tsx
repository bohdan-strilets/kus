import { cn, useSvgId } from '@/shared/lib'

import { BRAND_NAME, MIN_SIZE_WITH_LETTER } from './brand.constants'
import { BiteMask, BittenCircle, LogoGradient } from './brand-svg'

export interface LogoMarkProps {
	size?: number
	/** Without the «k» — for very small sizes. Below 20px the letter hides automatically. */
	hasLetter?: boolean
	/** Single-colour version: the cookie colour. */
	monoColor?: string
	/** false — the mark is decorative (the «kusik» wordmark sits next to it). */
	isLabelled?: boolean
	className?: string
}

/** The mark: a bitten gingerbread with a cream «k». Geometry 1:1 with mockups/brand-logo.html. */
export const LogoMark = ({
	size = 40,
	hasLetter = true,
	monoColor,
	isLabelled = true,
	className,
}: LogoMarkProps) => {
	const gradientId = useSvgId('lg')
	const maskId = useSvgId('lm')
	const shouldShowLetter = hasLetter && size >= MIN_SIZE_WITH_LETTER

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 100 100"
			className={cn('shrink-0', className)}
			role={isLabelled ? 'img' : undefined}
			aria-label={isLabelled ? BRAND_NAME : undefined}
			aria-hidden={isLabelled ? undefined : true}
		>
			<defs>
				{!monoColor && <LogoGradient id={gradientId} />}
				<BiteMask id={maskId} />
			</defs>
			<BittenCircle fill={monoColor ?? `url(#${gradientId})`} maskId={maskId} />
			{shouldShowLetter && (
				<text
					x="47"
					y="66"
					textAnchor="middle"
					fontFamily="Manrope, sans-serif"
					fontWeight={800}
					fontSize="46"
					fill={monoColor ? 'var(--color-primary)' : 'var(--color-logo-letter)'}
				>
					k
				</text>
			)}
		</svg>
	)
}
