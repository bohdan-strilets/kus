import { motion } from 'motion/react'

import { PRESS } from '@/shared/lib'

interface DemoButtonProps {
	label: string
	onClick: () => void
}

/** Dev-only trigger; Level 0 Button replaces it in stage 1 part 2. */
export const DemoButton = ({ label, onClick }: DemoButtonProps) => (
	<motion.button
		type="button"
		onClick={onClick}
		{...PRESS}
		className="min-h-tap rounded-chip bg-surface/85 px-3.5 text-caption shadow-chip"
	>
		{label}
	</motion.button>
)
