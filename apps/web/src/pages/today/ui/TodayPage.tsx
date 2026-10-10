import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { dayQueryOptions, daysRangeQueryOptions, useLocalToday } from '@/entities/day'
import { useSessionUser } from '@/entities/session'
import { WeekStrip } from '@/entities/stats'
import { EditEntrySheet } from '@/features/edit-entry'
import { EditGoalsSheet, toGoalValues } from '@/features/edit-goals'
import { ROUTES } from '@/shared/config'
import { fromCalendarDate, toCalendarDate } from '@/shared/lib'
import { DecorBackdrop, Skeleton, InlineError } from '@/shared/ui'

import { getDayTitle } from '../lib/get-day-title'
import { getWeekDays, getWeekStart } from '../lib/get-week-days'
import { useDayNavigation } from '../model/use-day-navigation'
import { DayContent } from './DayContent'
import { TodayHeader } from './TodayHeader'

/** design/docs/screens.md → Сьогодні: the week strip, the chosen day's card, meals and support. */
export const TodayPage = () => {
	const user = useSessionUser()
	// the session guard renders /app only with a user; this keeps the types honest
	if (!user) return null
	return <TodayScreen timeZone={user.timezone} />
}

const TodayScreen = ({ timeZone }: { timeZone: string }) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const today = useLocalToday(timeZone)
	const navigation = useDayNavigation(today)
	const [isGoalOpen, setIsGoalOpen] = useState(false)
	const dayQuery = useQuery(dayQueryOptions(navigation.selected))
	// the sheet changes the goal from today on: it starts from today's goal, even on a past day
	const todayQuery = useQuery(dayQueryOptions(today))
	const weekQuery = useQuery(
		daysRangeQueryOptions({ from: getWeekStart(navigation.windowEnd), to: navigation.windowEnd }),
	)
	const weekDays = weekQuery.data ? getWeekDays(navigation.windowEnd, weekQuery.data) : null
	// the current week without any food (the first days) is today-empty: no strip, as in the mockup;
	// a past week keeps it, so its days stay reachable
	const hasWeek =
		weekDays !== null &&
		(navigation.windowEnd !== today || weekDays.some((day) => day.status !== 'empty'))
	const isToday = navigation.selected === today
	const isEmptyDay = dayQuery.data?.meals.length === 0

	return (
		<div className="relative isolate flex flex-1 flex-col">
			{/* decor only on the empty state, behind everything (docs/motion.md: data screens have none) */}
			{isEmptyDay && <DecorBackdrop />}
			<TodayHeader
				localDate={navigation.selected}
				title={getDayTitle({ localDate: navigation.selected, today, t })}
				onPreviousWeek={navigation.showPreviousWeek}
				onNextWeek={navigation.showNextWeek}
			/>
			<div className="flex flex-1 flex-col gap-2.5 px-gutter">
				{weekQuery.isPending && <Skeleton shape="block" className="h-19 rounded-bubble-ai" />}
				{weekQuery.isError && (
					<InlineError
						message={t('today.weekLoadError')}
						onRetry={() => void weekQuery.refetch()}
					/>
				)}
				{weekDays && hasWeek && (
					<WeekStrip
						days={weekDays}
						selectedDate={toCalendarDate(navigation.selected)}
						onSelect={(date) => {
							navigation.select(fromCalendarDate(date))
						}}
					/>
				)}
				<DayContent
					query={dayQuery}
					isToday={isToday}
					onGoalClick={() => {
						setIsGoalOpen(true)
					}}
					onEmptyAction={() => {
						if (isToday) void navigate(ROUTES.chat)
						else navigation.select(today)
					}}
				/>
			</div>
			<EditGoalsSheet
				isOpen={isGoalOpen}
				onOpenChange={setIsGoalOpen}
				goal={toGoalValues(todayQuery.data?.goal ?? null)}
			/>
			<EditEntrySheet />
		</div>
	)
}
