import { useTranslation } from 'react-i18next'

import { useStackBack } from '@/shared/lib'

import { Heading } from '../heading'
import { Icon } from '../icon'
import { IconButton } from '../icon-button'
import { Text } from '../text'
import { BACK_ICON_SIZE } from './screen-header.constants'

export interface ScreenHeaderProps {
	title: string
	subtitle?: string
	/** The parent screen: where «Назад» lands when nothing of the app is behind (a deep link). */
	backTo: string
}

/**
 * Header of inner screens (profile, my-data, settings): a 44px back button and the title beside it.
 * Back is a button, not a link — it walks the history (useStackBack), so a Link's push would leave
 * every tap as one more entry and the iOS swipe-back would reopen the screen just left.
 */
export const ScreenHeader = ({ title, subtitle, backTo }: ScreenHeaderProps) => {
	const { t } = useTranslation()
	const goBack = useStackBack(backTo)

	return (
		<header className="flex items-center gap-3 px-gutter pt-5.5 pb-2">
			<IconButton label={t('common.back')} variant="frosted" onClick={goBack}>
				<Icon name="chevron-left" size={BACK_ICON_SIZE} />
			</IconButton>
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
