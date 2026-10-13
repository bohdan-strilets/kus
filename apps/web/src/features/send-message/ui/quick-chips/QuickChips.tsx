import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { expandVariants, TRANSITION } from '@/shared/lib'
import { Chip } from '@/shared/ui'

import { useStartWeightDraft } from '../../model/use-start-weight-draft'

/**
 * The row above the composer (mockups/chat-weight.html); only «Додати вагу» exists so far. It
 * folds by height and fades, so the feed does not jump when it comes or goes.
 */
export const QuickChips = ({ isShown }: { isShown: boolean }) => {
	const { t } = useTranslation()
	const startWeightDraft = useStartWeightDraft()
	const shouldReduceMotion = useReducedMotion()

	return (
		<AnimatePresence initial={false}>
			{isShown && (
				<motion.div
					key="quick-chips"
					variants={expandVariants}
					initial="hidden"
					animate="visible"
					exit="hidden"
					transition={shouldReduceMotion ? { duration: 0 } : TRANSITION.fast}
					className="overflow-hidden"
				>
					<div
						role="group"
						aria-label={t('chat.quickChips.label')}
						className="flex gap-2 px-1 pt-1 pb-3"
					>
						<Chip onClick={startWeightDraft}>{t('chat.quickChips.addWeight')}</Chip>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
