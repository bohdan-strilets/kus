import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, INTL_LOCALE, PRESS } from '@/shared/lib'

export interface UserAvatarProps {
	/** The user's name; the avatar shows its first letter. */
	name: string
	/** 46 in the full chat header, 44 in the collapsed one (mockups chat, chat-compact). */
	size?: 'md' | 'sm'
	onClick?: () => void
}

/**
 * The initial on the warm gradient with a white ring — opens profile and memory. The mockups set
 * the letter 16/800; it takes the body size (15), the nearest text role (docs/design-tokens.md).
 */
export const UserAvatar = ({ name, size = 'md', onClick }: UserAvatarProps) => {
	const { t } = useTranslation()

	return (
		<motion.button
			type="button"
			aria-label={t('user.profile')}
			onClick={onClick}
			{...PRESS}
			className={cn(
				'flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-avatar text-body font-extrabold text-ink shadow-chip',
				size === 'md' ? 'size-11.5' : 'size-11',
			)}
		>
			{name.charAt(0).toLocaleUpperCase(INTL_LOCALE)}
		</motion.button>
	)
}
