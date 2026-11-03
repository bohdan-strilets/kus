import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { StartWorkoutButtons } from '@/features/live-workout'
import { ROUTES } from '@/shared/config'
import { Surface, Text } from '@/shared/ui'

/** mockups/training-home.html «Порожнє тренування»: no program, so [Почати] and [Заповнити] start an empty session. */
export const EmptyWorkoutCard = () => {
	const { t } = useTranslation()

	return (
		<Surface radius="card" className="flex flex-none flex-col gap-2.5 p-3.5">
			<div className="flex flex-col gap-0.5">
				<Text as="span" variant="body" weight="bold">
					{t('training.empty.title')}
				</Text>
				<Text as="span" variant="small" tone="muted" weight="regular">
					{t('training.empty.text')}
				</Text>
			</div>
			<StartWorkoutButtons templateId={null} />
			<Link
				to={ROUTES.chat}
				className="-mb-1 flex min-h-tap items-center self-start text-card-title font-bold text-primary-deep underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
			>
				{t('training.empty.program')}
			</Link>
		</Surface>
	)
}
