import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { rowVariants } from '@/shared/lib'

export interface EntryCardRowProps {
	children: ReactNode
}

/** One line of a meal card: takes part in the cascade the card's row container starts. */
export const EntryCardRow = ({ children }: EntryCardRowProps) => (
	<motion.div variants={rowVariants}>{children}</motion.div>
)
