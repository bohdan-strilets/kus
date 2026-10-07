import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { UserAvatar } from '@/entities/user'
import { formatDayHeading } from '@/shared/lib'
import { Heading, IconButton, LogoMark, Text, WORDMARK } from '@/shared/ui'

import { SEED_TODAY } from '../../model/seed'

const CHAT_LOGO_SIZE = 22
const CARET_SIZE = 18

/**
 * Dev-only stand-ins for the chat and «Сьогодні» headers so the previews can be compared with the
 * screenshots. The real headers are widgets built with the screens.
 */
export const ChatPreviewHeader = () => {
	const { t } = useTranslation()

	return (
		<header className="flex items-center justify-between px-5 pt-5.5 pb-3">
			<div className="flex flex-col gap-0.5">
				<Text
					as="span"
					variant="caption"
					weight="regular"
					tone="muted"
					className="flex items-center gap-1.5"
				>
					<LogoMark size={CHAT_LOGO_SIZE} isLabelled={false} />
					<span className="font-extrabold text-ink">{WORDMARK}</span>·{' '}
					{formatDayHeading(SEED_TODAY)}
				</Text>
				<Heading as="h3">{t('devUi.seed.greeting')}</Heading>
			</div>
			<UserAvatar name={t('devUi.seed.userName')} />
		</header>
	)
}

export const TodayPreviewHeader = () => {
	const { t } = useTranslation()

	return (
		<header className="flex items-center justify-between px-5 pt-5.5 pb-2.5">
			<div className="flex flex-col gap-0.5">
				<Text as="span" variant="caption" weight="regular" tone="muted">
					{formatDayHeading(SEED_TODAY)}
				</Text>
				<Heading as="h3">{t('devUi.seed.todayTitle')}</Heading>
			</div>
			<div className="flex gap-2">
				<IconButton variant="frosted" label={t('devUi.seed.prevDay')}>
					<CaretLeftIcon aria-hidden size={CARET_SIZE} weight="bold" />
				</IconButton>
				<IconButton variant="frosted" disabled label={t('devUi.seed.nextDay')}>
					<CaretRightIcon aria-hidden size={CARET_SIZE} weight="bold" />
				</IconButton>
			</div>
		</header>
	)
}
