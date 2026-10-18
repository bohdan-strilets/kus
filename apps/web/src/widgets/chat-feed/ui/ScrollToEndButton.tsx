import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { keepFieldFocus, popInVariants } from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton } from '@/shared/ui'

interface ScrollToEndButtonProps {
	isShown: boolean
	onPress: () => void
}

export const ScrollToEndButton = ({ isShown, onPress }: ScrollToEndButtonProps) => {
	const { t } = useTranslation()

	return (
		<AnimatePresence>
			{isShown && (
				<motion.div
					variants={popInVariants}
					initial="hidden"
					animate="visible"
					exit="hidden"
					className="absolute right-gutter bottom-3"
				>
					<IconButton
						variant="primary"
						size="md"
						label={t('chat.scrollToEnd')}
						onClick={onPress}
						onPointerDown={keepFieldFocus}
						onMouseDown={keepFieldFocus}
						className="shadow-card"
					>
						<Icon name="chevron-down" size={ICON_SIZE.control} />
					</IconButton>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
