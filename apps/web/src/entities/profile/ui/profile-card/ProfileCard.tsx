import { motion } from 'motion/react'

import { INTL_LOCALE, PRESS } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

export interface ProfileCardProps {
	name: string
	subtitle: string
	onClick: () => void
}

/** profile: the avatar with the initial, the name and «Ціль: … · з …»; opens the address sheet. */
export const ProfileCard = ({ name, subtitle, onClick }: ProfileCardProps) => (
	<Surface variant="list" shadow="list">
		<motion.button
			type="button"
			aria-haspopup="dialog"
			onClick={onClick}
			{...PRESS}
			className="flex w-full cursor-pointer items-center gap-3.5 p-4 text-left"
		>
			<span
				aria-hidden="true"
				className="flex size-15 shrink-0 items-center justify-center rounded-full border-3 border-white bg-avatar text-field-number-sm text-ink shadow-chip"
			>
				{name.charAt(0).toLocaleUpperCase(INTL_LOCALE)}
			</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="truncate text-name text-ink">{name}</span>
				<Text as="span" variant="caption" tone="muted">
					{subtitle}
				</Text>
			</span>
		</motion.button>
	</Surface>
)
