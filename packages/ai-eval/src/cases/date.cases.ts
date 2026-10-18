// Other days (v0.6.2): food for yesterday, tomorrow or a weekday, and what is out of reach — older than
// 3 days, further than tomorrow, or too vague. Clock: Wednesday 2026-10-07; the window is Sun 10-04 … Thu 10-08.
// Judged by the `date` of log_food: a contract without it logs everything on today, so these cases stay red.
import { atClock, buildDays, EVAL_TODAY, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

const ASKS_WHEN = ['коли', 'який день', 'який саме день']
const NOT_LOGGED = ['записав', 'додав']

export const DATE_CASES: EvalCase[] = [
	{
		id: 'date-tomorrow-work',
		text: 'на завтра на роботу: курка запечена 150 г, рис варений 150 г і салат з овочів 200 г',
		expect: {
			decision: 'log',
			logDate: '2026-10-08',
			kcal: range(450, 600),
			replyIncludes: ['08.10'],
			replyIncludesAny: ['завтра'],
		},
		reference:
			'A plan for tomorrow (Thursday 2026-10-08) is logged on that day and the reply names it; «на роботу» is not a meal type. Chicken 150 g ~250 + rice 150 g ~195 + vegetable salad 200 g ~80–150',
	},
	{
		id: 'date-yesterday-evening-pizza',
		text: 'вчора ввечері ще були 2 шматки піци, не записалось',
		expect: {
			decision: 'log',
			logDate: '2026-10-06',
			kcal: range(450, 650),
			itemMeals: [{ stem: 'піц', mealType: 'DINNER' }],
			replyIncludesAny: ['вчора'],
		},
		reference: 'Yesterday evening → 2026-10-06, DINNER; 2 slices of pizza 100–130 g × 250–280 kcal',
	},
	{
		id: 'date-day-before-yesterday',
		text: 'позавчора на обід вареники з картоплею 10 шт',
		expect: {
			decision: 'log',
			logDate: '2026-10-05',
			itemMeals: [{ stem: 'вареник', mealType: 'LUNCH' }],
		},
		reference: 'The day before yesterday = 2026-10-05, 2 days back; LUNCH',
	},
	{
		id: 'date-weekday-past-boundary',
		text: 'у неділю на сніданок був омлет з 3 яєць',
		expect: { decision: 'log', logDate: '2026-10-04' },
		reference: 'The last Sunday is 2026-10-04: exactly 3 days back, the oldest day allowed',
	},
	{
		id: 'date-weekday-forward',
		text: 'на четвер беру з собою гречку варену 200 г з котлетою',
		expect: { decision: 'log', logDate: '2026-10-08' },
		reference: 'Thursday is tomorrow (2026-10-08), the furthest day ahead',
	},
	{
		id: 'date-too-old-explicit',
		text: '1 жовтня на роботі був шматок торта',
		expect: {
			decision: 'reply',
			replyIncludesAny: ['3 дн', '4 жовтня', '04.10', 'з 4 по 8', '4 по 8'],
			replyExcludes: ['записав у', 'додав у', 'записав на', 'додав на'],
		},
		reference:
			'1 October is 6 days back, outside the 3-day window: nothing is logged, the reply says how far back Kusik can add (3 days, from 4 October)',
	},
	{
		id: 'date-last-week',
		text: 'минулого тижня в понеділок була шаурма',
		expect: { decision: 'reply', replyExcludes: NOT_LOGGED },
		reference: 'Monday of last week (2026-09-28) is far outside the window: nothing is logged',
	},
	{
		id: 'date-too-far-ahead',
		text: 'на суботу: гречка з котлетою',
		expect: {
			decision: 'reply',
			replyIncludesAny: ['завтра', '08.10'],
			replyExcludes: NOT_LOGGED,
		},
		reference:
			'Saturday (2026-10-10) is 3 days ahead; only tomorrow is allowed: nothing is logged, the reply says so',
	},
	{
		id: 'date-unclear-na-dnyakh',
		text: 'на днях їв шаурму, запиши',
		expect: { decision: 'reply', replyIncludesAny: ASKS_WHEN },
		reference: '«На днях» names no day: Kusik asks which one and logs nothing',
	},
	{
		id: 'date-unclear-weekend',
		text: "у вихідні з'їв піцу",
		expect: { decision: 'reply' },
		reference: '«У вихідні» may be Saturday or Sunday: ambiguous, so a question and nothing logged',
	},
	{
		id: 'date-mixed-days',
		text: 'вчора на вечерю 2 шматки піци, а сьогодні на сніданок омлет з 2 яєць',
		expect: {
			decision: 'log',
			itemDates: [
				{ stem: 'піц', date: '2026-10-06' },
				{ stem: 'омлет', date: '2026-10-07' },
			],
		},
		reference:
			'One message, two days: every item carries its own day (pizza yesterday, omelette today)',
	},
	{
		id: 'date-today-regression',
		text: 'сьогодні на обід тарілка борщу',
		expect: {
			decision: 'log',
			logDate: '2026-10-07',
			itemMeals: [{ stem: 'борщ', mealType: 'LUNCH' }],
		},
		reference: '«Сьогодні» is today: no date needed (null = 2026-10-07), nothing changes for today',
	},
	{
		id: 'date-tomorrow-with-clarify',
		text: 'на завтра 100 г гречки',
		expect: { decision: 'clarify', logDate: '2026-10-08' },
		reference: 'Cooked ~110 vs dry ~343 kcal → a question, and the log still goes to tomorrow',
	},
	{
		id: 'date-after-midnight',
		text: 'вчора на вечерю гречка з куркою',
		context: atClock('2026-10-08 00:40, Thursday'),
		expect: { decision: 'log', logDate: '2026-10-07' },
		reference:
			'At 00:40 of Thursday «вчора» is Wednesday 2026-10-07: the day comes from the local clock, not from habit',
	},
	{
		id: 'date-yesterday-edit-out-of-context',
		text: 'вчорашню піцу зміни на 3 шматки',
		context: { days: buildDays(EVAL_TODAY, { '2026-10-06': { kcal: 2310, entryCount: 4 } }) },
		expect: { decision: 'reply', replyIncludesAny: ['редагувати', 'Редагувати'] },
		reference:
			'Yesterday has entries (2310 kcal in Days) but they are not in the e1… list: nothing is edited, the reply says to open that day and edit there',
	},
]
