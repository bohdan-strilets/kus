import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'

import { WORDMARK, WORDMARK_GAP_SCALE, WORDMARK_SCALE } from './logo.constants'
import { LogoMark } from './LogoMark'

export interface LogoProps {
	size?: number
	className?: string
}

/** Mark + «kusik» wordmark: 0.7 × size, weight 800, tracking −0.04em, ink. */
export const Logo = ({ size = 32, className }: LogoProps) => {
	const { t } = useTranslation()

	return (
		<span
			role="img"
			aria-label={t('brand.name')}
			className={cn('inline-flex items-center', className)}
			style={{ gap: size * WORDMARK_GAP_SCALE }}
		>
			<LogoMark size={size} label="" />
			<span
				aria-hidden="true"
				className="text-wordmark text-ink"
				style={{ fontSize: Math.round(size * WORDMARK_SCALE) }}
			>
				{WORDMARK}
			</span>
		</span>
	)
}
