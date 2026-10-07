import { useTranslation } from 'react-i18next'

import { AppLayout, Button, Hamster, Heading, Icon, ICON_SIZE, Text } from '@/shared/ui'

const HAMSTER_SIZE = 120

/**
 * The session check failed on the network or with a 5xx. The session may well be alive, so this
 * is «retry», never a redirect to /login. No mockup: the EmptyState pattern from docs (hamster
 * `oops`, title, text, one primary button).
 */
export const SessionErrorState = ({ onRetry }: { onRetry: () => void }) => {
	const { t } = useTranslation()

	return (
		<AppLayout>
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
					{t('common.retry')}
				</Button>
			</div>
		</AppLayout>
	)
}
