import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import {
	cn,
	formatInteger,
	getBarFillTransition,
	RING_FILL,
	ringGlowVariants,
	useCountUp,
} from '@/shared/lib'

import { useReplay } from '../../model/use-replay'
import { DemoCard } from '../DemoCard'

// Seed data from design/docs/screens.md: 1 370 of 2 200 kcal, Б 78/140 · В 160/225 · Ж 48/80
const EATEN_KCAL = 1370
const GOAL_KCAL = 2200
const MACRO_DEMO = [
	{ id: 'protein', percent: 56, className: 'bg-protein-bar' },
	{ id: 'carbs', percent: 71, className: 'bg-carbs-bar' },
	{ id: 'fat', percent: 60, className: 'bg-fat-bar' },
] as const

/** Semicircle from the chat header mockup (112×70). */
const ARC_PATH = 'M10 62 A46 46 0 0 1 102 62'

const DemoArc = ({ ratio }: { ratio: number }) => (
	<svg width="112" height="70" viewBox="0 0 112 70" fill="none" aria-hidden="true">
		<path d={ARC_PATH} className="stroke-track" strokeWidth="11" strokeLinecap="round" />
		<motion.path
			d={ARC_PATH}
			className="stroke-success"
			strokeWidth="11"
			strokeLinecap="round"
			initial={{ pathLength: 0 }}
			animate={{ pathLength: ratio }}
			transition={{ duration: RING_FILL.duration, ease: RING_FILL.ease }}
		/>
	</svg>
)

const CountedKcal = () => {
	const ref = useCountUp<HTMLSpanElement>(EATEN_KCAL, { durationMs: RING_FILL.duration * 1000 })
	return (
		<span ref={ref} className="text-big-number tabular-nums">
			{formatInteger(EATEN_KCAL)}
		</span>
	)
}

export const DataMotionDemos = () => {
	const { t } = useTranslation()
	const [ringKey, replayRing] = useReplay()
	const [barsKey, replayBars] = useReplay()
	const [glowKey, replayGlow] = useReplay()

	return (
		<>
			<DemoCard title={t('devUi.demo.ring')} onReplay={replayRing}>
				<div key={ringKey} className="flex items-center gap-4 self-center">
					<DemoArc ratio={EATEN_KCAL / GOAL_KCAL} />
					<CountedKcal />
				</div>
			</DemoCard>

			<DemoCard title={t('devUi.demo.bars')} onReplay={replayBars}>
				<div key={barsKey} className="flex flex-col gap-2">
					{MACRO_DEMO.map((macro, index) => (
						<div key={macro.id} className="h-1.5 rounded-full bg-divider">
							<motion.div
								className={cn('h-full rounded-full', macro.className)}
								initial={{ width: 0 }}
								animate={{ width: `${macro.percent}%` }}
								transition={getBarFillTransition(index)}
							/>
						</div>
					))}
				</div>
			</DemoCard>

			<DemoCard title={t('devUi.demo.glow')} onReplay={replayGlow}>
				<motion.div
					key={glowKey}
					variants={ringGlowVariants}
					initial="rest"
					animate="glow"
					className="self-center"
				>
					<DemoArc ratio={1} />
				</motion.div>
			</DemoCard>
		</>
	)
}
