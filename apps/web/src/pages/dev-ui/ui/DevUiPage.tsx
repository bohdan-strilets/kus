import { useTranslation } from 'react-i18next'

import { addDevMessages } from '@/shared/i18n'
import { AppLayout, Heading, Text } from '@/shared/ui'
import { BottomNav } from '@/widgets/bottom-nav'

import { ChatPartsSection } from './domain/ChatPartsSection'
import { ComposerSection } from './domain/ComposerSection'
import { FacesSection } from './domain/FacesSection'
import { FoodIconsSection } from './domain/FoodIconsSection'
import { FormatSection } from './domain/FormatSection'
import { PreviewsSection } from './domain/PreviewsSection'
import { StatsSection } from './domain/StatsSection'
import { ButtonsSection } from './level0/ButtonsSection'
import { ChipsBadgesSection } from './level0/ChipsBadgesSection'
import { FormsSection } from './level0/FormsSection'
import { IconButtonsSection } from './level0/IconButtonsSection'
import { LoadingSection } from './level0/LoadingSection'
import { OverlaysSection } from './level0/OverlaysSection'
import { SurfacesSection } from './level0/SurfacesSection'
import { BrandSection } from './sections/BrandSection'
import { CelebrateSection } from './sections/CelebrateSection'
import { HamsterSection } from './sections/HamsterSection'
import { MotionSection } from './sections/MotionSection'
import { SoundsSection } from './sections/SoundsSection'
import { TokensSection } from './sections/TokensSection'

// the catalogue's own strings ship only with this dev-only chunk
addDevMessages()

/**
 * Dev-only catalogue of the design system (registered only when import.meta.env.DEV).
 * It runs inside AppLayout with the real BottomNav, so both are on the page too.
 */
export const DevUiPage = () => {
	const { t } = useTranslation()

	return (
		<AppLayout bottomNav={<BottomNav hasProgressUpdate />}>
			<div className="flex flex-col gap-8 px-gutter pb-12">
				<header className="flex flex-col gap-1 pt-6">
					<Heading as="h1">{t('devUi.title')}</Heading>
					<Text variant="caption" tone="muted">
						{t('devUi.description')}
					</Text>
					<Text variant="caption" tone="muted">
						{t('devUi.level0.navHint')}
					</Text>
				</header>
				<PreviewsSection />
				<ChatPartsSection />
				<FacesSection />
				<StatsSection />
				<ComposerSection />
				<FoodIconsSection />
				<FormatSection />
				<SurfacesSection />
				<ButtonsSection />
				<IconButtonsSection />
				<FormsSection />
				<ChipsBadgesSection />
				<LoadingSection />
				<OverlaysSection />
				<TokensSection />
				<BrandSection />
				<HamsterSection />
				<MotionSection />
				<CelebrateSection />
				<SoundsSection />
			</div>
		</AppLayout>
	)
}
