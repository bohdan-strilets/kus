import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DemoButton } from './DemoButton'

interface DemoCardProps {
	title: string
	onReplay: () => void
	actionLabel?: string
	children: ReactNode
}

export const DemoCard = ({ title, onReplay, actionLabel, children }: DemoCardProps) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
			<div className="flex items-center justify-between gap-2">
				<span className="text-card-title">{title}</span>
				<DemoButton label={actionLabel ?? t('devUi.replay')} onClick={onReplay} />
			</div>
			<div className="relative flex min-h-20 flex-col justify-center">{children}</div>
		</div>
	)
}
