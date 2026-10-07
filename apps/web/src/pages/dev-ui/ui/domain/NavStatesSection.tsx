import { useTranslation } from 'react-i18next'

import { ROUTES } from '@/shared/config'
import { Text } from '@/shared/ui'
import { BottomNavPreview } from '@/widgets/bottom-nav'

import { SEED_EATEN_KCAL, SEED_GOAL_KCAL } from '../../model/seed'
import { DevSection } from '../DevSection'

/** The rows of design/mockups/brand-nav-states.html: empty day, 1 370 / 2 200, goal, +35 %. */
const OVER_GOAL_PROGRESS = 1.35
const DAY_STATES = [
	{ labelKey: 'devUi.navStates.empty', progress: 0 },
	{ labelKey: 'devUi.navStates.partial', progress: SEED_EATEN_KCAL / SEED_GOAL_KCAL },
	{ labelKey: 'devUi.navStates.closed', progress: 1 },
	{ labelKey: 'devUi.navStates.over', progress: OVER_GOAL_PROGRESS },
] as const

export const NavStatesSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.navStates')}>
			{DAY_STATES.map(({ labelKey, progress }) => (
				<div key={labelKey} className="flex flex-col gap-2">
					<Text variant="caption" weight="bold">
						{t(labelKey)}
					</Text>
					<Text variant="small" tone="muted">
						{t('devUi.navStates.todayActive')}
					</Text>
					<BottomNavPreview activeTo={ROUTES.today} todayProgress={progress} />
					<Text variant="small" tone="muted">
						{t('devUi.navStates.otherActive')}
					</Text>
					<BottomNavPreview activeTo={ROUTES.chat} todayProgress={progress} />
				</div>
			))}
			<Text variant="caption" weight="bold">
				{t('devUi.navStates.otherTabs')}
			</Text>
			<BottomNavPreview
				activeTo={ROUTES.progress}
				todayProgress={SEED_EATEN_KCAL / SEED_GOAL_KCAL}
			/>
			<BottomNavPreview
				activeTo={ROUTES.recipes}
				todayProgress={SEED_EATEN_KCAL / SEED_GOAL_KCAL}
			/>
		</DevSection>
	)
}
