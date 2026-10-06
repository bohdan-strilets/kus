import { useTranslation } from 'react-i18next'

import { useSvgId } from '@/shared/lib'

import { MIN_LETTER_SIZE } from './logo.constants'
import { BiteMask, LogoGradient } from './LogoDefs'

export interface LogoMarkProps {
	size?: number
	/** Without the «k» — for the loader and tiny sizes (< 20px). */
	hasLetter?: boolean
	/** `mono` fills the cookie with currentColor (e.g. white on a primary button). */
	variant?: 'gradient' | 'mono'
	/** Accessible name; pass '' when a visible wordmark sits next to the mark. */
	label?: string
	className?: string
}

/**
 * The bitten gingerbread: a circle with three bites top-right and a cream «k».
 * Geometry 1:1 with design/mockups/brand-logo.html — don't change the bite angle or count.
 */
export const LogoMark = ({
	size = 40,
	hasLetter = true,
	variant = 'gradient',
	label,
	className,
}: LogoMarkProps) => {
	const { t } = useTranslation()
	const gradientId = useSvgId('lg')
	const maskId = useSvgId('lm')
	const isMono = variant === 'mono'
	const isLetterShown = hasLetter && size >= MIN_LETTER_SIZE
	const accessibleName = label ?? t('brand.name')
	const isDecorative = accessibleName === ''

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 100 100"
			role={isDecorative ? undefined : 'img'}
			aria-label={isDecorative ? undefined : accessibleName}
			aria-hidden={isDecorative || undefined}
			className={className}
		>
			<defs>
				{!isMono && <LogoGradient id={gradientId} />}
				<BiteMask id={maskId} />
			</defs>
			<circle
				cx="50"
				cy="50"
				r="42"
				fill={isMono ? 'currentColor' : `url(#${gradientId})`}
				mask={`url(#${maskId})`}
			/>
			{isLetterShown && (
				<text
					x="47"
					y="66"
					textAnchor="middle"
					fontSize="46"
					className="font-sans font-extrabold"
					fill={isMono ? 'var(--color-primary)' : 'var(--color-logo-letter)'}
				>
					k
				</text>
			)}
		</svg>
	)
}
