import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, TRANSITION } from '@/shared/lib'

export type LiveBarSegment = 'done' | 'current' | 'todo'

/** «Вправа 3 з 6»: a segment per exercise, `success` done, `primary` in hand, `track` to come; a segment fills by width, base. */
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
				<span key={index} className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
					<motion.span
						initial={false}
						animate={{ width: segment === 'todo' ? '0%' : '100%' }}
						transition={TRANSITION.base}
						className={cn(
							'block h-full rounded-full',
							segment === 'done' && 'bg-success',
							segment === 'current' && 'bg-primary',
						)}
					/>
				</span>
			))}
		</div>
	)
}
