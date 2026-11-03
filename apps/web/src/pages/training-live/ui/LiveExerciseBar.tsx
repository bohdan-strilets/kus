import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'

export type LiveBarSegment = 'done' | 'current' | 'todo'

/** «Вправа 3 з 6»: a segment per exercise, `success` done, `primary` in hand, `track` to come. */
export const LiveExerciseBar = ({ segments }: { segments: readonly LiveBarSegment[] }) => {
	const { t } = useTranslation()
	const currentIndex = segments.indexOf('current')
	if (segments.length === 0) return null

	return (
		<div
			role="img"
			aria-label={t('training.live.progress', {
				current: currentIndex === -1 ? segments.length : currentIndex + 1,
				total: segments.length,
			})}
			className="flex gap-1 px-gutter pb-2"
		>
			{segments.map((segment, index) => (
				<span
					key={index}
					className={cn(
						'h-1.5 flex-1 rounded-full',
						segment === 'done' && 'bg-success',
						segment === 'current' && 'bg-primary',
						segment === 'todo' && 'bg-track',
					)}
				/>
			))}
		</div>
	)
}
