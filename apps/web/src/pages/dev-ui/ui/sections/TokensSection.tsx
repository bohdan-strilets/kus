import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'

import { COLOR_GROUPS, RADII, SHADOWS, TEXT_STYLES } from '../../model/token-catalog'
import { DevSection } from '../DevSection'

/** Marks a token added on top of design/tokens. */
const ADDED_MARK = ' +'

export const TokensSection = () => {
	const { t } = useTranslation()

	return (
		<>
			<DevSection title={t('devUi.sections.colors')}>
				{COLOR_GROUPS.map((group) => (
					<div key={group[0]?.name} className="grid grid-cols-4 gap-2">
						{group.map((swatch) => (
							<div key={swatch.name} className="flex flex-col gap-1">
								<div className={cn('h-12 rounded-tile-sm shadow-chip', swatch.className)} />
								<span className="text-small break-words text-muted">
									{swatch.name}
									{swatch.isAdded && ADDED_MARK}
								</span>
							</div>
						))}
					</div>
				))}
			</DevSection>

			<DevSection title={t('devUi.sections.typography')}>
				<div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
					{TEXT_STYLES.map((style) => (
						<div key={style.name} className="flex flex-col">
							<span className="text-small text-muted">{style.name}</span>
							<span className={style.className}>{t('devUi.typographySample')}</span>
						</div>
					))}
				</div>
			</DevSection>

			<DevSection title={t('devUi.sections.radii')}>
				<div className="grid grid-cols-3 gap-3">
					{RADII.map((radius) => (
						<div key={radius.name} className="flex flex-col items-center gap-1">
							<div className={cn('size-16 bg-primary-soft', radius.className)} />
							<span className="text-small text-muted">{radius.name}</span>
						</div>
					))}
				</div>
			</DevSection>

			<DevSection title={t('devUi.sections.shadows')}>
				<div className="grid grid-cols-3 gap-4">
					{SHADOWS.map((shadow) => (
						<div
							key={shadow.name}
							className={cn(
								'flex h-16 items-center justify-center rounded-tile bg-surface',
								shadow.className,
							)}
						>
							<span className="text-small text-muted">{shadow.name}</span>
						</div>
					))}
				</div>
			</DevSection>
		</>
	)
}
