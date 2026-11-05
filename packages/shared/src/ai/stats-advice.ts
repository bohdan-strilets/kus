// The numbers the model gets for advice on a stats card: counted by the backend, never by the model.
import { STATS_PERIOD_DAYS, type StatsCard } from '../schemas/stats-card.js'

/** 2160 → "2 160": the thousands are split by a space so that the model reads one number. */
const formatNumber = (value: number): string =>
	String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

const formatAverages = (card: StatsCard): string | null => {
	const parts: string[] = []
	if (card.avgKcal !== null) {
		const goal = card.goalKcal === null ? '' : ` (goal ${formatNumber(card.goalKcal)})`
		parts.push(`average ${formatNumber(card.avgKcal)} kcal${goal}`)
	}
	if (card.avgProteinG !== null) {
		const goal = card.proteinGoalG === null ? '' : ` (goal ${formatNumber(card.proteinGoalG)} g)`
		parts.push(`protein ${formatNumber(card.avgProteinG)} g${goal}`)
	}
	return parts.length === 0 ? null : parts.join(', ')
}

/**
 * The `{{period}}` of the tool result, without a closing period (the template adds it):
 * `7 days 2026-10-30–2026-11-05: logged 6 of 7 days; average 2 160 kcal (goal 2 200), protein 121 g
 * (goal 140 g); in the goal 5 of 6 logged days, over 1`. No weight; no goal — no "in the goal".
 */
export const formatStatsAdviceNumbers = (card: StatsCard): string => {
	const days = card.periodDays ?? STATS_PERIOD_DAYS[card.period]
	const parts = [
		`${days} days ${card.from}–${card.to}: logged ${card.loggedDays} of ${days} days`,
		formatAverages(card),
		card.goalKcal === null
			? null
			: `in the goal ${card.daysInNorm} of ${card.loggedDays} logged days, over ${card.loggedDays - card.daysInNorm}`,
	]
	return parts.filter((part): part is string => part !== null).join('; ')
}

/** The tool result of show_stats for the second call from ready numbers (not in the cached prefix). */
export const buildStatsAdviceToolResultFromNumbers = (numbers: string): string =>
	`Numbers of the period, already counted (count nothing yourself): ${numbers}. ` +
	'Answer with reply only: the advice the user asked for, up to ~5 sentences or a short list, numbers only from here, no reproach for days over the goal.'

export const buildStatsAdviceToolResult = (card: StatsCard): string =>
	buildStatsAdviceToolResultFromNumbers(formatStatsAdviceNumbers(card))
