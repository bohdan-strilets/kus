import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'

import { dayQueryOptions } from '@/entities/day'
import { CompactDayBar, getDayStats } from '@/entities/stats'
import { useGreeting, UserAvatar } from '@/entities/user'
import { ROUTES } from '@/shared/config'
import { formatDayHeading, toCalendarDate, TRANSITION } from '@/shared/lib'
import { Heading, LogoMark, Text, WORDMARK } from '@/shared/ui'

import { DaySummarySlot } from './DaySummarySlot'

export interface ChatHeaderProps {
	userName: string
	timeZone: string
	today: string
	/** The user scrolled up: the compact bar (mockups/chat-compact.html). */
	isCompact: boolean
}

const FULL_LOGO_SIZE = 22
const COMPACT_LOGO_SIZE = 30
/** docs motion 6: the header swaps by opacity + a small shift, base. */
const SWAP = {
	initial: { opacity: 0, y: -6 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -6 },
	transition: TRANSITION.base,
}

/** docs Header (chat): the date, the greeting, the avatar and the day card; collapses on scroll. */
export const ChatHeader = ({ userName, timeZone, today, isCompact }: ChatHeaderProps) => {
	const navigate = useNavigate()
	const greeting = useGreeting({ name: userName, timeZone })
	const dayQuery = useQuery(dayQueryOptions(today))
	const stats = dayQuery.data ? getDayStats(dayQuery.data) : null
	const openProfile = (): void => {
		void navigate(ROUTES.profile)
	}

	return (
		<AnimatePresence mode="wait" initial={false}>
			{isCompact ? (
				<motion.header
					key="compact"
					{...SWAP}
					className="flex items-center gap-2.5 px-gutter pt-4.5 pb-2"
				>
					<LogoMark size={COMPACT_LOGO_SIZE} isLabelled={false} />
					{stats ? (
						<CompactDayBar eaten={stats.eaten} goal={stats.goal} protein={stats.macros.protein} />
					) : (
						<span className="flex-1" />
					)}
					<UserAvatar name={userName} size="sm" onClick={openProfile} />
				</motion.header>
			) : (
				<motion.header key="full" {...SWAP} className="flex flex-col gap-0">
					<div className="flex items-center justify-between px-5 pt-5.5 pb-3">
						<div className="flex min-w-0 flex-col gap-0.5">
							<Text
								as="span"
								variant="caption"
								weight="regular"
								tone="muted"
								className="flex items-center gap-1.5"
							>
								<LogoMark size={FULL_LOGO_SIZE} isLabelled={false} />
								<span className="font-extrabold text-ink">{WORDMARK}</span>·{' '}
								{formatDayHeading(toCalendarDate(today))}
							</Text>
							<Heading as="h1">{greeting}</Heading>
						</div>
						<UserAvatar name={userName} onClick={openProfile} />
					</div>
					<div className="px-gutter">
						<DaySummarySlot query={dayQuery} />
					</div>
				</motion.header>
			)}
		</AnimatePresence>
	)
}
