import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { cn, PRESS } from '@/shared/lib'

import { Heading } from '../heading'
import { Icon } from '../icon'
import { iconButtonVariants } from '../icon-button'
import { Text } from '../text'
import { BACK_ICON_SIZE } from './screen-header.constants'

const MotionLink = motion.create(Link)

export interface ScreenHeaderProps {
	title: string
	subtitle?: string
	/** Where the round «Назад» button leads. */
	backTo: string
}

/** Header of inner screens (profile, my-data, settings): a 44px back button and the title beside it. */
export const ScreenHeader = ({ title, subtitle, backTo }: ScreenHeaderProps) => {
	const { t } = useTranslation()

	return (
		<header className="flex items-center gap-3 px-gutter pt-5.5 pb-2">
			<MotionLink
				to={backTo}
				aria-label={t('common.back')}
				className={cn(iconButtonVariants({ variant: 'frosted' }))}
				{...PRESS}
			>
				<Icon name="chevron-left" size={BACK_ICON_SIZE} />
			</MotionLink>
			<div className="flex min-w-0 flex-col">
				<Heading as="h1">{title}</Heading>
				{subtitle && (
					<Text variant="caption" tone="muted">
						{subtitle}
					</Text>
				)}
			</div>
		</header>
	)
}
