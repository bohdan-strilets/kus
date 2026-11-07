import { useTranslation } from 'react-i18next'

import { useLastSeenLive } from '@/features/live-workout'
import { FEATURES } from '@/shared/config'
import { AppLayout, Button, Hamster, Heading, Icon, ICON_SIZE, Text } from '@/shared/ui'
import { BottomNav } from '@/widgets/bottom-nav'
import { WorkoutMiniStrip } from '@/widgets/workout-mini-strip'

import { preloadTrainingLive } from './lazy-pages'

const HAMSTER_SIZE = 120

/**
 * The session check failed on the network or with a 5xx. The session may well be alive, so this
 * is «retry», never a redirect to /login. mockups/training-offline.html: the same hamster `oops`
 * screen inside the app shell, so the tabs stay tappable and the running workout (the copy this
 * device holds) is one tap away on the mini strip, marked «без мережі».
 */
export const SessionErrorState = ({
	onRetry,
	canOpenLive = false,
}: {
	onRetry: () => void
	/** Offline with a live session of this device's last user: the live route renders from the copy. */
	canOpenLive?: boolean
}) => {
	const { t } = useTranslation()
	const lastSeen = useLastSeenLive()

	return (
		<AppLayout
			bottomNav={<BottomNav todayProgress={0} />}
			hasRaisedNav={FEATURES.workouts}
			miniStrip={
				canOpenLive && lastSeen ? (
					<WorkoutMiniStrip live={lastSeen} isOffline onWarm={preloadTrainingLive} />
				) : undefined
			}
		>
			<div
				role="alert"
				className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
			>
				<Hamster mood="oops" size={HAMSTER_SIZE} />
				<Heading as="h1">{t('errors.session.title')}</Heading>
				<Text tone="muted" className="max-w-75">
					{t('errors.session.description')}
				</Text>
				<Button icon={<Icon name="retry" size={ICON_SIZE.control} />} onClick={onRetry}>
					{t('errors.session.retry')}
				</Button>
			</div>
		</AppLayout>
	)
}
