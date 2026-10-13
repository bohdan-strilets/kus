import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type ProgressRange, useProgress } from '@/entities/progress'
import { cn } from '@/shared/lib'
import { DecorBackdrop, Heading, InlineError } from '@/shared/ui'

import { ProgressContent } from './ProgressContent'
import { ProgressEmpty } from './ProgressEmpty'
import { ProgressSkeleton } from './ProgressSkeleton'
import { RangeToggle } from './RangeToggle'

/** The mockup opens on the month: a week of weigh-ins is too little for a line. */
const INITIAL_RANGE: ProgressRange = 30

/**
 * design/docs/screens.md → Прогрес: the period switch drives weight and waist only; the calorie
 * week is always the last 7 days. Loading is a skeleton, a failure is inline with «Повторити».
 */
export const ProgressPage = () => {
	const { t } = useTranslation()
	const [range, setRange] = useState<ProgressRange>(INITIAL_RANGE)
	const query = useProgress(range)
	const progress = query.data

	return (
		<div className="relative isolate flex flex-1 flex-col">
			{/* decor only on the empty state, as on today-empty */}
			{progress?.isEmpty === true && <DecorBackdrop />}
			<header className="flex items-end justify-between px-5 pt-5.5 pb-3">
				<Heading as="h1">{t('pages.progress.title')}</Heading>
				<RangeToggle value={range} onChange={setRange} />
			</header>
			{progress?.isEmpty === true ? (
				<ProgressEmpty />
			) : (
				<div
					aria-busy={query.isPlaceholderData}
					className={cn(
						'flex flex-col gap-2.5 px-gutter pb-2 transition-opacity',
						query.isPlaceholderData && 'opacity-60',
					)}
				>
					{progress && <ProgressContent progress={progress} range={range} />}
					{!progress && query.isError && (
						<InlineError message={t('progress.loadError')} onRetry={() => void query.refetch()} />
					)}
					{!progress && query.isPending && <ProgressSkeleton />}
				</div>
			)}
		</div>
	)
}
