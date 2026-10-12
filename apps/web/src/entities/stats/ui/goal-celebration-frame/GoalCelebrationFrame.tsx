import type { ReactNode } from 'react'
import { useRef } from 'react'

import { cn } from '@/shared/lib'

import { useGoalCelebration } from '../../model/use-goal-celebration'
import { DEFAULT_GOAL_PARTICLE_DISTANCE } from './goal-celebration-frame.constants'

interface GoalCelebration {
	userId: string
	today: string
}

export interface GoalCelebrationFrameProps {
	/** Given only for today's ring: it is the one that celebrates the day goal. */
	celebration?: GoalCelebration
	particleDistance?: number
	className?: string
	children: ReactNode
}

/**
 * Wraps a day ring so the day goal can light it up (glow and particles); without `celebration` it
 * stays a plain box. The wrapper never changes type, so the ring inside is not remounted when
 * `celebration` comes and goes.
 */
export const GoalCelebrationFrame = ({
	celebration,
	particleDistance = DEFAULT_GOAL_PARTICLE_DISTANCE,
	className,
	children,
}: GoalCelebrationFrameProps) => {
	const hostRef = useRef<HTMLDivElement>(null)
	const glowRef = useRef<HTMLSpanElement>(null)
	useGoalCelebration({
		userId: celebration?.userId,
		today: celebration?.today,
		hostRef,
		originRef: hostRef,
		glowRef,
		particleDistance,
	})

	return (
		<div ref={hostRef} className={cn('relative isolate', className)}>
			{/* a static blur: only its opacity and scale are animated */}
			{celebration && (
				<span
					ref={glowRef}
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-success opacity-0 blur-glow"
				/>
			)}
			{children}
		</div>
	)
}
