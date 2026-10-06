import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { Button, Skeleton, Surface, Text } from '@/shared/ui'

import { useHealth } from '../../model/use-health'

const STATUS_ICON_SIZE = 24

export const HealthStatus = () => {
	const { t } = useTranslation()
	const { isPending, isError, isFetching, refetch } = useHealth()
	const isRetrying = isError && isFetching

	if (isPending || isRetrying) {
		return (
			<div role="status" aria-label={t('common.loading')}>
				<Skeleton shape="block" className="h-14" />
			</div>
		)
	}

	if (isError) {
		return (
			<Surface radius="tile" role="alert" className="flex items-center gap-3 px-4 py-2">
				<WarningCircleIcon
					aria-hidden
					size={STATUS_ICON_SIZE}
					weight="fill"
					className="shrink-0 text-danger"
				/>
				<Text className="flex-1">{t('health.error')}</Text>
				<Button size="md" onClick={() => void refetch()}>
					{t('common.retry')}
				</Button>
			</Surface>
		)
	}

	return (
		<Surface
			radius="tile"
			role="status"
			aria-label={t('health.label')}
			className="flex min-h-14 items-center gap-3 px-4"
		>
			<CheckCircleIcon
				aria-hidden
				size={STATUS_ICON_SIZE}
				weight="fill"
				className="shrink-0 text-success"
			/>
			<Text>{t('health.ok')}</Text>
		</Surface>
	)
}
