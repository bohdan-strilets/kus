// v0.7.0 tools: close_day, show_stats and log_food.copyRef («Earlier entries»), plus questions about the
// log answered from the context. The verdict of a closed day and the copied numbers are the backend's:
// here only the choice of the tool and its arguments are judged. Clock: Wednesday 2026-10-07, 13:20.
import type { EarlierEntryContext } from '@kus/shared'

import { buildDays, entry, EVAL_TODAY, exact } from './case-builders.js'
import type { EvalCase } from './case.types.js'
import { DAY_TWO_MEALS } from './day-card.cases.js'

const YESTERDAY = '2026-10-06'
const MONDAY = '2026-10-05'

/** Today has four entries (895 kcal) in the "Days" line too, as the backend sends it. */
const TODAY_LOGGED: EvalCase['context'] = {
	...DAY_TWO_MEALS,
	days: buildDays(EVAL_TODAY, { [EVAL_TODAY]: { kcal: 895, entryCount: 4 } }),
}

const YESTERDAY_LOGGED: EvalCase['context'] = {
	days: buildDays(EVAL_TODAY, { [YESTERDAY]: { kcal: 1480, entryCount: 3 } }),
}

const earlierEntry = (
	ref: string,
	date: string,
	mealType: EarlierEntryContext['mealType'],
	name: string,
	grams: number,
	kcal: number,
): EarlierEntryContext => ({ ref, date, mealType, name, grams, kcal })

const SOUP = earlierEntry('y1', YESTERDAY, 'LUNCH', 'Суп гороховий', 850, 510)

/** Masculine forms about the user are out of replies (the copy stays gender-neutral). */
const GENDERED_FORMS = ['ти додав ', 'додавав', 'додавал', 'записав ']

const NOTHING_LOGGED = ['нічого не записано', 'ще нічого']

/** Numbers of kcal are the backend's: a reply carries none (dates like 05.10 are fine). */
const NO_KCAL_IN_REPLY = ['ккал', 'kcal', 'калор']

const COFFEE_TODAY: EvalCase['context'] = {
	...DAY_TWO_MEALS,
	entries: [...(DAY_TWO_MEALS?.entries ?? []), entry('e5', 'Кава', 'SNACK', 200, 5, 'coffee')],
}

const NO_COFFEE_TODAY: EvalCase['context'] = {
	dayTotals: { kcal: 330, protein: 12, fat: 8, carbs: 55 },
	meals: [{ type: 'BREAKFAST', kcal: 330 }],
	entries: [entry('e1', 'Вівсянка на молоці', 'BREAKFAST', 300, 330, 'porridge')],
}

export const HISTORY_CARD_CASES: EvalCase[] = [
	{
		id: 'close-day',
		text: 'День закрито',
		context: TODAY_LOGGED,
		expect: { decision: 'close_day', closeDay: { date: EVAL_TODAY, estimatedTotalKcal: null } },
		reference: 'The day is done and has entries → close_day for today, nothing else logged',
	},
	{
		id: 'close-day-estimate',
		text: 'Вчорашній день закрий десь на 4000',
		context: YESTERDAY_LOGGED,
		expect: { decision: 'close_day', closeDay: { date: YESTERDAY, estimatedTotalKcal: 4000 } },
		reference:
			'The user named the total of yesterday themselves → close_day for 2026-10-06 with 4000, the gap is logged by the backend',
	},
	{
		id: 'close-day-unknown',
		text: 'закрий день',
		expect: {
			decision: 'reply',
			replyIncludesAny: NOTHING_LOGGED,
			replyExcludes: NO_KCAL_IN_REPLY,
		},
		reference:
			'An empty day → a reply that nothing is logged yet; no close_day card, no log_food, no numbers',
	},
	{
		id: 'close-day-unknown-with-entries',
		text: 'закрий день, решту не пам’ятаю',
		context: TODAY_LOGGED,
		expect: { decision: 'close_day', closeDay: { date: EVAL_TODAY, estimatedTotalKcal: null } },
		reference:
			'The day has entries and the user names no total → close_day for today with a null total, nothing logged (a log_food next to it turns the decision into «log»)',
	},
	{
		id: 'close-day-with-food',
		text: 'ще яблуко, і день закрито',
		context: TODAY_LOGGED,
		expect: { decision: 'log', categories: ['fruit'], replyIncludes: ['День закрито'] },
		reference:
			'Food next to «день закрито» → only log_food (no close_day); the reply ends with the hint «Щоб закрити день, напиши «День закрито».»',
	},
	{
		id: 'close-day-too-early',
		text: 'закрий день 1 жовтня',
		context: TODAY_LOGGED,
		expect: { decision: 'reply', replyExcludes: NO_KCAL_IN_REPLY },
		reference: `2026-10-01 is 6 days back, the "Days" line starts at 2026-10-04 → a reply that the day is out of reach; no close_day`,
	},
	{
		id: 'close-day-extra-not-total',
		text: 'ще ккал 500 не записав',
		context: TODAY_LOGGED,
		expect: { decision: 'log', kcal: exact(500) },
		reference:
			'«Ще 500 ккал» is an addition to the logged day, not its total → log_food of 500 kcal; no close_day',
	},
	{
		id: 'stats-last-week',
		text: 'Як пройшов минулий тиждень?',
		expect: { decision: 'stats', stats: { period: 'week', endDate: '2026-10-04' } },
		reference:
			'Today is Wednesday 2026-10-07 → «last week» ends on Sunday 2026-10-04: show_stats week with that endDate',
	},
	{
		id: 'copy-but-changed',
		text: 'Той самий суп, але без сметани',
		context: { earlier: [SOUP] },
		expect: { decision: 'log', copyRefs: [], maxItems: 1 },
		reference:
			'«Той самий, але без …» is a changed dish → estimated anew, no copyRef (the stored numbers include the sour cream)',
	},
	{
		id: 'stats-week',
		text: 'Підбий підсумок за тиждень',
		expect: { decision: 'stats', stats: { period: 'week' } },
		reference: 'A summary of the week → show_stats week, numbers are the backend card',
	},
	{
		id: 'stats-month',
		text: 'Як я харчувався за місяць?',
		expect: { decision: 'stats', stats: { period: 'month' } },
		reference: 'A question about the month → show_stats month, not a reply with guessed numbers',
	},
	{
		id: 'same-soup-as-yesterday',
		text: 'Той самий суп, що й учора',
		context: { earlier: [SOUP] },
		expect: { decision: 'log', copyRefs: ['y1'], kcal: exact(510), maxItems: 1 },
		reference:
			'«Той самий» + yesterday in Earlier entries → copyRef y1 (850 g, 510 kcal as stored), no memoryRef, no new numbers',
	},
	{
		id: 'copy-again-kabanosy',
		text: 'Знову кабаноси',
		context: { earlier: [earlierEntry('h1', '2026-10-01', 'SNACK', 'Кабаноси', 50, 230)] },
		expect: { decision: 'log', copyRefs: ['h1'], kcal: exact(230), maxItems: 1 },
		reference: '«Знову» + a named older entry → copyRef h1',
	},
	{
		id: 'copy-once-more-buckwheat',
		text: 'Ще раз ту саму гречку',
		context: { earlier: [earlierEntry('h1', '2026-10-03', 'DINNER', 'Гречка варена', 200, 220)] },
		expect: { decision: 'log', copyRefs: ['h1'], kcal: exact(220), maxItems: 1 },
		reference: '«Ще раз ту саму» + a named older entry → copyRef h1',
	},
	{
		id: 'copy-yesterday-dinner',
		text: 'Що й учора на вечерю',
		context: {
			earlier: [
				earlierEntry('y1', YESTERDAY, 'BREAKFAST', 'Омлет', 150, 270),
				earlierEntry('y2', YESTERDAY, 'DINNER', 'Курка запечена', 180, 297),
				earlierEntry('y3', YESTERDAY, 'DINNER', 'Салат овочевий', 150, 120),
			],
		},
		expect: { decision: 'log', copyRefs: ['y2', 'y3'], kcal: exact(417) },
		reference: "Yesterday's dinner is two entries → copyRef y2 and y3, the omelette is not copied",
	},
	{
		id: 'copy-same-breakfast',
		text: 'Такий самий сніданок',
		context: {
			earlier: [
				earlierEntry('y1', YESTERDAY, 'BREAKFAST', 'Вівсянка на молоці', 300, 330),
				earlierEntry('y2', YESTERDAY, 'BREAKFAST', 'Кава з молоком', 250, 90),
				earlierEntry('y3', YESTERDAY, 'LUNCH', 'Борщ', 350, 175),
			],
		},
		expect: { decision: 'log', copyRefs: ['y1', 'y2'], kcal: exact(420) },
		reference:
			'«Такий самий сніданок» → copyRef of both breakfast entries of yesterday, not the lunch',
	},
	{
		id: 'no-marker-ask-what',
		text: 'Додай той обід з понеділка',
		expect: { decision: 'reply', replyExcludes: NO_KCAL_IN_REPLY },
		reference: `No marker, no Earlier entries (Monday ${MONDAY} is not in the context) → a reply without log_food and without invented kcal`,
	},
	{
		id: 'q-did-i-add-coffee-yes',
		text: 'Я сьогодні додавав каву?',
		context: COFFEE_TODAY,
		expect: {
			decision: 'reply',
			replyIncludesAny: ['так', 'додан', 'записан'],
			replyExcludes: ['немає', 'нічого', 'не бачу', ...GENDERED_FORMS],
		},
		reference:
			'Coffee is among the entries of the day → a short «yes» reply, nothing logged, no card',
	},
	{
		id: 'q-did-i-add-coffee-no',
		text: 'Я сьогодні додавав каву?',
		context: NO_COFFEE_TODAY,
		expect: {
			decision: 'reply',
			replyIncludesAny: [
				'немає',
				'не бачу',
				'ще не',
				'поки не',
				'не додан',
				'не записан',
				'не було',
			],
			replyExcludes: GENDERED_FORMS,
		},
		reference: 'No coffee among the entries → a short «no» reply, nothing logged, no card',
	},
	{
		id: 'last-time-ratatouille',
		text: 'Коли я останній раз додавав рататуй?',
		context: { earlier: [earlierEntry('h1', '2026-09-29', 'DINNER', 'Рататуй', 300, 210)] },
		expect: {
			decision: 'reply',
			replyIncludesAny: ['29.09', '29 вересня'],
			replyExcludes: GENDERED_FORMS,
		},
		reference: 'A question about the past → reply with the date of h1 (29.09), nothing logged',
	},
	{
		id: 'weight-yesterday-decimal',
		text: 'Вчора зважився, 81.4',
		expect: {
			decision: 'reply',
			replyExcludes: ['81'],
			measurements: [{ kind: 'WEIGHT', value: 81.4, date: YESTERDAY }],
		},
		reference:
			'«Вчора» → log_measurement for 2026-10-06; the reply does not repeat the weight (a dd.mm date in it is fine)',
	},
	{
		id: 'weight-other-day-reply',
		text: 'Позавчора вага 80.9',
		expect: {
			decision: 'reply',
			replyMatches: ['\\d{2}\\.\\d{2}'],
			replyExcludes: ['80'],
			measurements: [{ kind: 'WEIGHT', value: 80.9, date: MONDAY }],
		},
		reference:
			'A weight for another day → log_measurement for 2026-10-05; the reply starts with the date dd.mm and does not repeat the value',
	},
]
