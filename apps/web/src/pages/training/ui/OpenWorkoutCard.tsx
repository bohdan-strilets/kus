import type { LiveWorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { formatElapsed } from '@/features/live-workout'
import { TRAINING_LIVE_ROUTE } from '@/shared/config'
import { useNow } from '@/shared/lib'
import { Button, Surface, Text } from '@/shared/ui'

const TICK_MS = 1000

/** mockups/training-home.html «Іде · 23:14»: the open session instead of «Наступне», with [Продовжити]. */
export const OpenWorkoutCard = ({ live }: { live: LiveWorkoutResponse }) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const elapsed = formatElapsed(live.workout.startedAt, useNow(TICK_MS))
	const name = live.templateName ?? t('training.live.defaultName')

	return (
		<Surface radius="card" className="flex flex-none items-center gap-3 p-3.5">
			<span className="flex min-w-0 flex-1 flex-col">
				<Text as="span" variant="body" weight="bold" className="truncate">
					{name}
				</Text>
				<Text as="span" variant="small" tone="muted" isTabular>
					{t('training.open.running', { time: elapsed })}
				</Text>
			</span>
			<Button
				onClick={() => {
					void navigate(TRAINING_LIVE_ROUTE)
				}}
			>
				{t('training.open.continue')}
			</Button>
		</Surface>
	)
}
