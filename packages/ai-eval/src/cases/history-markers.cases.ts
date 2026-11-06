// History markers (0.10.6): what an earlier user turn wrote and what became of it — the model must not
// take a later deletion for its own lie, and must trust a saved fact instead of saving it again.
// Clock: Wed 2026-10-07.
import { NO_MEMORY_CALLS } from './case-builders.js'
import type { EvalCase } from './case.types.js'

/** The reply must not confess to a lie or a mistake it didn't make. */
const NO_APOLOGY = ['вибач', 'перепрош', 'збрехав', 'зарано']

const PIZZA = { ref: 'e1', name: 'Піца маргарита', grams: 250, kcal: 640 }
const PIZZA_DELETED_HISTORY = [
	{
		role: 'user' as const,
		content: 'на обід 2 шматки піци маргарита',
		loggedRefs: ['e1'],
		deletedLoggedRefs: ['e1'],
	},
	{ role: 'assistant' as const, content: 'Записав піцу маргарита: 250 г, 640 ккал.' },
]

const SHIFTS = 'Змінний графік: тиждень удень, тиждень уночі'

export const HISTORY_MARKER_CASES: EvalCase[] = [
	{
		id: 'history-food-deleted-what-ate',
		text: 'а що я сьогодні їв?',
		context: { deletedEntries: [PIZZA], history: PIZZA_DELETED_HISTORY },
		expect: {
			decision: 'reply',
			replyIncludesAny: ['видал', 'нічого', 'порожн'],
			replyExcludes: NO_APOLOGY,
		},
		reference:
			'The pizza was logged and deleted later: today is empty, no apology for a «lie», no claim that it is logged',
	},
	{
		id: 'history-food-deleted-you-logged',
		text: 'ти ж записав піцу?',
		context: { deletedEntries: [PIZZA], history: PIZZA_DELETED_HISTORY },
		expect: { decision: 'reply', replyIncludesAny: ['видал'], replyExcludes: NO_APOLOGY },
		reference:
			'«Записав» was true, the entry was deleted later: say so, no apology, no restore unasked',
	},
	{
		id: 'history-weight-deleted',
		text: 'яка в мене зараз вага?',
		context: {
			history: [
				{
					role: 'user',
					content: 'вага 82,4',
					measurements: [{ kind: 'weight', isDeleted: true }],
				},
				{ role: 'assistant', content: 'Записав вагу 82,4 кг.' },
			],
		},
		expect: {
			decision: 'reply',
			replyIncludesAny: ['видал', 'немає', 'нема'],
			replyExcludes: NO_APOLOGY,
		},
		reference:
			'The weight was logged and deleted later: no current weight, no apology, not 82,4 as the current value',
	},
	{
		id: 'history-fact-saved-trust',
		text: "ти точно запам'ятав мій графік?",
		context: {
			facts: [SHIFTS],
			history: [
				{
					role: 'user',
					content: "запам'ятай: працюю тиждень удень, тиждень уночі",
					facts: [{ kind: 'saved', ref: 'f1', isDeleted: false }],
				},
				{ role: 'assistant', content: "Запам'ятав твій графік: тиждень удень, тиждень уночі." },
			],
		},
		expect: { decision: 'reply', memory: NO_MEMORY_CALLS, replyExcludes: NO_APOLOGY },
		reference:
			'[fact saved: f1] and the fact in «User facts»: confirm, no second save, no forget, no apology',
	},
]
