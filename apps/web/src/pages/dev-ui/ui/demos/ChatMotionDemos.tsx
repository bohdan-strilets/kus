import { CheckIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import {
	bubbleVariants,
	HOP_KEYFRAMES,
	HOP_TRANSITION,
	popInVariants,
	ROW_STAGGER_S,
	rowVariants,
	SHAKE_KEYFRAMES,
	SHAKE_TRANSITION,
	tabContentVariants,
} from '@/shared/lib'
import { HamsterHead } from '@/shared/ui'

import { useReplay } from '../../model/use-replay'
import { DemoCard } from '../DemoCard'

const DEMO_ROWS = [1, 2, 3] as const

export const ChatMotionDemos = () => {
	const { t } = useTranslation()
	const [bubbleKey, replayBubble] = useReplay()
	const [rowsKey, replayRows] = useReplay()
	const [badgeKey, replayBadge] = useReplay()
	const [hopKey, replayHop] = useReplay()
	const [shakeKey, replayShake] = useReplay()
	const [tabKey, replayTab] = useReplay()

	return (
		<>
			<DemoCard title={t('devUi.demo.bubble')} onReplay={replayBubble}>
				<motion.div
					key={bubbleKey}
					variants={bubbleVariants}
					initial="hidden"
					animate="visible"
					className="self-end rounded-bubble rounded-br-tail bg-primary px-4 py-2.5 text-white shadow-accent"
				>
					{t('devUi.demo.bubbleText')}
				</motion.div>
			</DemoCard>

			<DemoCard title={t('devUi.demo.rows')} onReplay={replayRows}>
				<motion.ul
					key={rowsKey}
					initial="hidden"
					animate="visible"
					transition={{ staggerChildren: ROW_STAGGER_S }}
					className="flex flex-col gap-1"
				>
					{DEMO_ROWS.map((index) => (
						<motion.li
							key={index}
							variants={rowVariants}
							className="rounded-icon bg-field px-3 py-2"
						>
							{t('devUi.demo.rowText', { index })}
						</motion.li>
					))}
				</motion.ul>
			</DemoCard>

			<DemoCard title={t('devUi.demo.popIn')} onReplay={replayBadge}>
				<motion.span
					key={badgeKey}
					variants={popInVariants}
					initial="hidden"
					animate="visible"
					className="flex size-8 items-center justify-center self-center rounded-full bg-success text-white"
				>
					<CheckIcon aria-hidden size={18} weight="bold" />
				</motion.span>
			</DemoCard>

			<DemoCard title={t('devUi.demo.hop')} onReplay={replayHop}>
				<motion.span
					key={hopKey}
					animate={HOP_KEYFRAMES}
					transition={HOP_TRANSITION}
					className="self-center"
				>
					<HamsterHead mood="happy" size={48} />
				</motion.span>
			</DemoCard>

			<DemoCard title={t('devUi.demo.shake')} onReplay={replayShake}>
				<motion.div
					key={shakeKey}
					animate={SHAKE_KEYFRAMES}
					transition={SHAKE_TRANSITION}
					className="h-12 rounded-tile bg-surface shadow-field ring-2 ring-danger ring-inset"
				/>
			</DemoCard>

			<DemoCard title={t('devUi.demo.tab')} onReplay={replayTab}>
				<motion.div
					key={tabKey}
					variants={tabContentVariants}
					initial="hidden"
					animate="visible"
					className="h-12 rounded-tile bg-primary-soft"
				/>
			</DemoCard>
		</>
	)
}
