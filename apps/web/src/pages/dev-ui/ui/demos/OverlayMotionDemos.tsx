import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EASE, scrimVariants, sheetVariants } from '@/shared/lib'

import { DemoCard } from '../DemoCard'

/** Clarification expands by height: Motion `height: auto`, 250 ms (design/docs/motion.md). */
const EXPAND_TRANSITION = { duration: 0.25, ease: EASE.out }

export const OverlayMotionDemos = () => {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(false)
	const [isSheetOpen, setIsSheetOpen] = useState(false)

	return (
		<>
			<DemoCard
				title={t('devUi.demo.expand')}
				actionLabel={isExpanded ? t('devUi.close') : t('devUi.open')}
				onReplay={() => {
					setIsExpanded((value) => !value)
				}}
			>
				<motion.div
					initial={false}
					animate={isExpanded ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
					transition={EXPAND_TRANSITION}
					className="overflow-hidden"
				>
					<p className="rounded-tile bg-primary-selected p-4 text-card-title">
						{t('devUi.demo.expandText')}
					</p>
				</motion.div>
			</DemoCard>

			<DemoCard
				title={t('devUi.demo.sheet')}
				actionLabel={isSheetOpen ? t('devUi.close') : t('devUi.open')}
				onReplay={() => {
					setIsSheetOpen((value) => !value)
				}}
			>
				<div className="relative h-48 overflow-hidden rounded-tile bg-field">
					<AnimatePresence>
						{isSheetOpen && (
							<>
								<motion.div
									key="scrim"
									variants={scrimVariants}
									initial="hidden"
									animate="visible"
									exit="hidden"
									className="absolute inset-0 bg-scrim"
								/>
								<motion.div
									key="sheet"
									variants={sheetVariants}
									initial="hidden"
									animate="visible"
									exit="hidden"
									className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 rounded-t-sheet bg-surface px-4 pt-2.5 pb-7 shadow-sheet"
								>
									<span className="h-1.25 w-10 rounded-full bg-handle" />
									<p className="text-body">{t('devUi.demo.sheetText')}</p>
								</motion.div>
							</>
						)}
					</AnimatePresence>
				</div>
			</DemoCard>
		</>
	)
}
