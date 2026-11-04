import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, popInVariants, PRESS } from '@/shared/lib'
import { Icon, ICON_SIZE } from '@/shared/ui'

interface SetDoneToggleProps {
	/** «1», «Р»: names the set to a screen reader. */
	label: string
	isDone: boolean
	onToggle: () => void
	/** The row just appeared as a done one (the set block became a row): the ✓ pops at once. */
	isPoppedOnMount?: boolean
}

/** The ✓ 44 of a set row: filled `success` when the set is done (the check, not the colour alone, says it); it pops 0 → 1.25 → 1 when the set becomes done. */
export const SetDoneToggle = ({
	label,
	isDone,
	onToggle,
	isPoppedOnMount = false,
}: SetDoneToggleProps) => {
	const { t } = useTranslation()
	const [wasDone, setWasDone] = useState(isDone)
	const [hasBecomeDone, setHasBecomeDone] = useState(false)
	if (isDone !== wasDone) {
		setWasDone(isDone)
		setHasBecomeDone(isDone)
	}
	const shouldPop = isDone && (hasBecomeDone || isPoppedOnMount)

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
			<motion.span
				key={isDone ? 'done' : 'todo'}
				variants={popInVariants}
				initial={shouldPop ? 'hidden' : false}
				animate="visible"
				className="flex"
			>
				<Icon name="check" size={ICON_SIZE.control} />
			</motion.span>
		</motion.button>
	)
}
