import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, PRESS } from '@/shared/lib'
import { Icon, ICON_SIZE } from '@/shared/ui'

interface SetDoneToggleProps {
	/** «1», «Р»: names the set to a screen reader. */
	label: string
	isDone: boolean
	onToggle: () => void
}

/** The ✓ 44 of a set row: filled `success` when the set is done (the check, not the colour alone, says it). */
export const SetDoneToggle = ({ label, isDone, onToggle }: SetDoneToggleProps) => {
	const { t } = useTranslation()

	return (
		<motion.button
			type="button"
			aria-label={t('training.live.setDoneAria', { n: label })}
			aria-pressed={isDone}
			onClick={onToggle}
			{...PRESS}
			className={cn(
				'flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-2',
				isDone
					? 'border-success bg-success text-white'
					: 'border-line-strong bg-surface text-muted-strong',
			)}
		>
			<Icon name="check" size={ICON_SIZE.control} />
		</motion.button>
	)
}
