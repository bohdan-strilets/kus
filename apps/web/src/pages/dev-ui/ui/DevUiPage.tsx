import { useTranslation } from 'react-i18next'

import { BrandSection } from './sections/BrandSection'
import { CelebrateSection } from './sections/CelebrateSection'
import { HamsterSection } from './sections/HamsterSection'
import { MotionSection } from './sections/MotionSection'
import { SoundsSection } from './sections/SoundsSection'
import { TokensSection } from './sections/TokensSection'

/** Dev-only catalogue of the design system (registered only when import.meta.env.DEV). */
export const DevUiPage = () => {
	const { t } = useTranslation()

	return (
		<main className="mx-auto flex max-w-app flex-col gap-8 px-gutter pt-safe-top pb-12">
			<header className="flex flex-col gap-1 pt-6">
				<h1 className="text-screen-title">{t('devUi.title')}</h1>
				<p className="text-caption text-muted">{t('devUi.description')}</p>
			</header>
			<TokensSection />
			<BrandSection />
			<HamsterSection />
			<MotionSection />
			<CelebrateSection />
			<SoundsSection />
		</main>
	)
}
