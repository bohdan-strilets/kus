import { cn } from '@/shared/lib'

export interface DayDividerProps {
	/** «Сьогодні», «Вчора» or the date. */
	label: string
	isToday?: boolean
}

/**
 * The day pill in the feed (mockups/chat-new-day.html): 12/700 muted on white 70%; today is white
 * on primary — the day the user writes into.
 */
export const DayDivider = ({ label, isToday = false }: DayDividerProps) => (
	<h2
		className={cn(
			'self-center rounded-badge px-3 py-0.75 text-small font-bold',
			isToday ? 'bg-primary text-white' : 'bg-surface/70 text-muted',
		)}
	>
		{label}
	</h2>
)
