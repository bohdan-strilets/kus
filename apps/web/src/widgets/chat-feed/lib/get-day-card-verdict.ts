import type { DayCard, DayVerdict } from '@kus/shared'

import { formatInteger } from '@/shared/lib'

/** What stands to the right of the ring (mockups/chat-day-closed.html). */
export type DayCardVerdictAside =
	| { kind: 'inGoal' }
	| { kind: 'over'; kcal: number }
	| { kind: 'under'; kcal: number }
	| { kind: 'none' }

export type DayCardSentenceKey =
	| 'chat.dayCard.verdict.onGoal'
	| 'chat.dayCard.verdict.onGoalEstimate'
	| 'chat.dayCard.verdict.under'
	| 'chat.dayCard.verdict.farUnder'
	| 'today.support.large'

export interface DayCardSentence {
	key: DayCardSentenceKey
	values?: Record<string, string>
}

export interface DayCardVerdictView {
	verdict: Exclude<DayVerdict, 'empty'>
	aside: DayCardVerdictAside
	/** Kusik's fixed sentence under the meals; null when the card says nothing more («без цілі»). */
	sentence: DayCardSentence | null
	/** No goal, no ring: the day total stands in its place. */
	hasRing: boolean
}

/**
 * The verdict part of a closing day card. null for any other card — a plain look at a day, a card
 * from before 0.7.0 (no `verdict`), an empty day (the backend sends no card then) — they draw as
 * they always did. The sentence is fixed text, never the model's words: the card has its own; a
 * meal with the «Без деталей» estimate (`hasUndetailed`) makes it point at that estimate.
 */
export const getDayCardVerdictView = (card: DayCard): DayCardVerdictView | null => {
	const { verdict, isClosing, remainingKcal, totals, goal, meals } = card
	const hasEstimate = meals.some((meal) => meal.hasUndetailed)
	if (!isClosing || verdict === undefined || verdict === 'empty') return null

	const kcalLeft = Math.abs(remainingKcal ?? 0)
	const protein = formatInteger(totals.protein)
	const goalProtein = goal === null ? '' : formatInteger(goal.protein)

	switch (verdict) {
		case 'on_goal':
			return {
				verdict,
				aside: { kind: 'inGoal' },
				hasRing: true,
				sentence: hasEstimate
					? { key: 'chat.dayCard.verdict.onGoalEstimate' }
					: {
							key: 'chat.dayCard.verdict.onGoal',
							values: { protein, goal: goalProtein },
						},
			}
		case 'over':
			return {
				verdict,
				aside: { kind: 'over', kcal: kcalLeft },
				hasRing: true,
				sentence: { key: 'today.support.large', values: { over: formatInteger(kcalLeft) } },
			}
		case 'under':
			return {
				verdict,
				aside: { kind: 'under', kcal: kcalLeft },
				hasRing: true,
				sentence: { key: 'chat.dayCard.verdict.under', values: { protein, goal: goalProtein } },
			}
		case 'far_under':
			return {
				verdict,
				aside: { kind: 'none' },
				hasRing: true,
				sentence: { key: 'chat.dayCard.verdict.farUnder' },
			}
		case 'no_goal':
			return { verdict, aside: { kind: 'none' }, hasRing: false, sentence: null }
	}
}
