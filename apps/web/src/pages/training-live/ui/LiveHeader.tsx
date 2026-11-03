import { useTranslation } from 'react-i18next'

import { formatElapsed } from '@/features/live-workout'
import { useNow } from '@/shared/lib'
import { Button, Icon, ICON_SIZE, IconButton, Text } from '@/shared/ui'

interface LiveHeaderProps {
	name: string
	startedAt: string | null
	isFinishing: boolean
	onMinimize: () => void
	onFinish: () => void
}

const TICK_MS = 1000

/** mockups/training-live.html: «Згорнути» 44, the name over a 28/800 timer from the start, [Завершити] on `ink`. */
export const LiveHeader = ({
	name,
	startedAt,
	isFinishing,
	onMinimize,
	onFinish,
}: LiveHeaderProps) => {
	const { t } = useTranslation()
	const elapsed = formatElapsed(startedAt, useNow(TICK_MS))

	return (
		<header className="flex items-center gap-3 px-gutter pt-5.5 pb-2">
			<IconButton label={t('training.live.minimize')} variant="frosted" onClick={onMinimize}>
				<Icon name="chevron-down" size={ICON_SIZE.nav} />
			</IconButton>
			<div className="flex min-w-0 flex-1 flex-col">
				<Text as="span" variant="small" tone="mutedStrong" className="truncate">
					{name}
				</Text>
				<Text
					as="span"
					role="timer"
					aria-label={t('training.live.timerLabel', { time: elapsed })}
					className="text-gauge font-extrabold"
					isTabular
				>
					{elapsed}
				</Text>
			</div>
			<Button variant="dark" size="header" isLoading={isFinishing} onClick={onFinish}>
				{t('training.live.finish')}
			</Button>
		</header>
	)
}
