import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDelayedFlag } from '@/shared/lib'
import { Loader, Logo, LogoMark } from '@/shared/ui'

import { DemoButton } from '../DemoButton'
import { DevSection } from '../DevSection'

const MARK_SIZES = [16, 28, 40, 64] as const
const LOADER_SIZES = [64, 32, 28] as const

export const BrandSection = () => {
	const { t } = useTranslation()
	const [isWaiting, setIsWaiting] = useState(false)
	const isLoaderShown = useDelayedFlag(isWaiting)

	return (
		<DevSection title={t('devUi.sections.brand')}>
			<div className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card">
				<div className="flex flex-wrap items-center gap-4">
					<Logo size={32} />
					<Logo size={22} />
				</div>
				<div className="flex flex-wrap items-end gap-4">
					{MARK_SIZES.map((size) => (
						<LogoMark key={size} size={size} />
					))}
					<span className="flex size-12 items-center justify-center rounded-button bg-primary text-white">
						<LogoMark size={28} variant="mono" />
					</span>
				</div>
				<Loader size={120} label={t('devUi.loaderCaption')} />
				<div className="flex flex-wrap items-center gap-4">
					{LOADER_SIZES.map((size) => (
						<Loader key={size} size={size} />
					))}
					<span className="flex h-12 items-center rounded-button bg-primary px-4">
						<Loader size={20} tone="onPrimary" />
					</span>
				</div>
			</div>

			<p className="text-caption text-muted">{t('devUi.spinnerHint')}</p>
			<div className="flex items-center gap-3">
				<DemoButton
					label={isWaiting ? t('devUi.stopWaiting') : t('devUi.startWaiting')}
					onClick={() => {
						setIsWaiting((value) => !value)
					}}
				/>
				{isLoaderShown && <Loader size={28} />}
			</div>
		</DevSection>
	)
}
