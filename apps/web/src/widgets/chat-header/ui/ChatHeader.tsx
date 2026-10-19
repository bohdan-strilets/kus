import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router'

import { dayQueryOptions } from '@/entities/day'
import { useSessionUser } from '@/entities/session'
import { CompactDayBar, getDayStats } from '@/entities/stats'
import { type Addressee, useGreeting, UserAvatar } from '@/entities/user'
import { ROUTES } from '@/shared/config'
import { formatDayHeading, HEADER_SWAP, toCalendarDate } from '@/shared/lib'
import { Heading, LogoMark, Text, WORDMARK } from '@/shared/ui'

import { COMPACT_HEADER_HEIGHT_PX } from '../model/chat-header.constants'
import { useMeasuredHeight } from '../model/use-measured-height'
import { DaySummarySlot } from './DaySummarySlot'

export interface ChatHeaderProps {
	/** The avatar letter comes from the name, the greeting from the address. */
	addressee: Addressee
	timeZone: string
	today: string
	/** Scrolled up or typing: the compact bar (mockups/chat-compact.html). */
	isCompact: boolean
	/** Typing: a tap on the bar expands the header instead of opening «Сьогодні». */
	onExpand?: () => void
	/** The last measured height of the full header: the touch area it covers in the full mode. */
	fullHeight: number
	onFullHeightChange: (height: number) => void
}

const FULL_LOGO_SIZE = 22
const COMPACT_LOGO_SIZE = 30

/**
 * docs Header (chat): the date, the greeting, the avatar and the day card; collapses on scroll.
 * It floats over the feed, so a swap never re-lays the feed out, and it catches touches over its
 * whole area: a tap on its empty part must not land on the masked messages under it.
 */
export const ChatHeader = ({
	addressee,
	timeZone,
	today,
	isCompact,
	onExpand,
	fullHeight,
	onFullHeightChange,
}: ChatHeaderProps) => {
	const navigate = useNavigate()
	const greeting = useGreeting({ addressee, timeZone })
	const user = useSessionUser()
	const celebration = user ? { userId: user.id, today } : undefined
	const dayQuery = useQuery(dayQueryOptions(today))
	const stats = dayQuery.data ? getDayStats(dayQuery.data) : null
	const measureFull = useMeasuredHeight(onFullHeightChange)
	const openProfile = (): void => {
		void navigate(ROUTES.profile)
	}

	return (
		<div
			data-testid="chat-header"
			className="absolute inset-x-0 top-0 z-10"
			style={{ height: isCompact ? COMPACT_HEADER_HEIGHT_PX : fullHeight }}
		>
			<AnimatePresence initial={false}>
				{isCompact ? (
					<motion.header
						key="compact"
						{...HEADER_SWAP}
						className="absolute inset-x-0 top-0 flex items-center gap-2.5 px-gutter pt-4.5 pb-2"
					>
						<LogoMark size={COMPACT_LOGO_SIZE} isLabelled={false} />
						{stats ? (
							<CompactDayBar
								eaten={stats.eaten}
								goal={stats.goal}
								protein={stats.macros.protein}
								onExpand={onExpand}
								celebration={celebration}
							/>
						) : (
							<span className="flex-1" />
						)}
						<UserAvatar name={addressee.name ?? ''} size="sm" onClick={openProfile} />
					</motion.header>
				) : (
					<motion.header
						key="full"
						ref={measureFull}
						{...HEADER_SWAP}
						className="absolute inset-x-0 top-0 flex flex-col gap-0"
					>
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
							<UserAvatar name={addressee.name ?? ''} onClick={openProfile} />
						</div>
						<div className="px-gutter">
							<DaySummarySlot query={dayQuery} celebration={celebration} />
						</div>
					</motion.header>
				)}
			</AnimatePresence>
		</div>
	)
}
