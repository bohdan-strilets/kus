// The day card (v0.6.2): «покажи, що є», «скільки вже набралось?», «а що було вчора?» → show_day
// instead of a wordy answer; an empty day gets a plain reply. Clock: Wednesday 2026-10-07, 13:20.
import { buildDays, entry, EVAL_TODAY } from './case-builders.js'
import type { EvalCase } from './case.types.js'

/** Breakfast and lunch are logged: 895 kcal. */
const DAY_TWO_MEALS: EvalCase['context'] = {
	dayTotals: { kcal: 895, protein: 45, fat: 30, carbs: 112 },
	meals: [
		{ type: 'BREAKFAST', kcal: 420 },
		{ type: 'LUNCH', kcal: 475 },
	],
	entries: [
		entry('e1', 'Вівсянка на молоці', 'BREAKFAST', 300, 330, 'porridge'),
		entry('e2', 'Кава з молоком', 'BREAKFAST', 250, 90, 'coffee'),
		entry('e3', 'Борщ', 'LUNCH', 350, 175, 'borscht'),
		entry('e4', 'Котлета', 'LUNCH', 100, 300, 'meat'),
	],
}

const NOTHING_LOGGED = ['нічого не записано']

const TOMORROW = '2026-10-08'

/** Tomorrow has two planned entries (525 kcal). */
const TOMORROW_PLANNED: EvalCase['context'] = {
	days: buildDays(EVAL_TODAY, { [TOMORROW]: { kcal: 525, entryCount: 2 } }),
}

export const DAY_CARD_CASES: EvalCase[] = [
	{
		id: 'day-card-now',
		text: 'покажи, що є на зараз',
		context: DAY_TWO_MEALS,
		expect: { decision: 'day_card', dayCard: { date: '2026-10-07' } },
		reference: 'A request to see the day → the day card of today (null date), not a list in words',
	},
	{
		id: 'day-card-how-much',
		text: 'скільки вже набралось?',
		context: DAY_TWO_MEALS,
		expect: { decision: 'day_card', dayCard: { date: '2026-10-07' } },
		reference: "«Скільки набралось» asks for the day's total → the day card of today",
	},
	{
		id: 'day-card-yesterday',
		text: 'а що було вчора?',
		expect: { decision: 'day_card', dayCard: { date: '2026-10-06' } },
		reference: "Yesterday is in the window → the card of 2026-10-06, the numbers are the backend's",
	},
	{
		id: 'day-card-empty-today',
		text: 'покажи, що є',
		expect: { decision: 'reply', replyIncludesAny: NOTHING_LOGGED },
		reference: 'Nothing logged today: no empty card, a short reply that nothing is recorded yet',
	},
	{
		id: 'day-card-tomorrow',
		text: 'що в мене на завтра?',
		context: TOMORROW_PLANNED,
		expect: { decision: 'day_card', dayCard: { date: TOMORROW } },
		reference: 'Tomorrow has planned entries (Days context) → the card of 2026-10-08',
	},
	{
		id: 'day-card-empty-tomorrow',
		text: 'що в мене на завтра?',
		context: { days: buildDays(EVAL_TODAY) },
		expect: { decision: 'reply', replyIncludesAny: NOTHING_LOGGED },
		reference: 'Tomorrow is empty in the Days context → a short reply that nothing is recorded',
	},
]
