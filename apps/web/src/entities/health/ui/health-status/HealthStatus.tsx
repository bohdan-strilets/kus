import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { useHealth } from '../../model/use-health'

// Temporary styling until Surface / Button / Skeleton exist (roadmap stage 1)
export const HealthStatus = () => {
	const { t } = useTranslation()
	const { isPending, isError, isFetching, refetch } = useHealth()
	const isRetrying = isError && isFetching

	if (isPending || isRetrying) {
		return (
			<div
				role="status"
				aria-label={t('common.loading')}
				className="h-14 animate-pulse rounded-md bg-surface motion-reduce:animate-none"
			/>
		)
	}

	if (isError) {
		return (
			<div
				role="alert"
				className="flex items-center gap-3 rounded-md bg-surface px-4 py-2 shadow-card"
			>
				<WarningCircleIcon aria-hidden size={24} weight="fill" className="shrink-0 text-fat" />
				<p className="flex-1">{t('health.error')}</p>
				<button
					type="button"
					onClick={() => void refetch()}
					className="min-h-tap rounded-full bg-accent px-4 font-bold text-white"
				>
					{t('common.retry')}
				</button>
			</div>
		)
	}

	return (
		<div
			role="status"
			aria-label={t('health.label')}
			className="flex min-h-14 items-center gap-3 rounded-md bg-surface px-4 shadow-card"
		>
			<CheckCircleIcon aria-hidden size={24} weight="fill" className="shrink-0 text-accent" />
			<p>{t('health.ok')}</p>
		</div>
	)
}
