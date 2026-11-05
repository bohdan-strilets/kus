// Live chat (0.10.5): reply format and recipes, no judging words, the program card on request, the
// second call of «summary and advice», and the cardio repeat / «все» rules of the shorter Workouts
// text. Synthetic data only. Clock: Wed 2026-10-07 (evening cases 19:30).
import type { FoodParseContext, MemoryFoodContext, TodayWorkoutContext } from '@kus/shared'

import { atClock, entry, NO_MEMORY_CALLS } from './case-builders.js'
import type { EvalCase } from './case.types.js'
import { CONTEXT_PRESETS, DAY_WITH_GOAL } from './context-presets.js'
import { WITH_PROGRAM } from './program.cases.js'

const EVENING = atClock('2026-10-07 19:30, Wednesday')
const PREVIOUS_DAY = '2026-10-06'

/**
 * Stems of the judging words (reply-checks.ts findJudgingWords, plan 0.10.5 question 7) for
 * replyExcludes, which compares lower-case text; "погано" with a space so "непогано" passes.
 */
const JUDGING_STEMS = [
	'зрив',
	'зірв',
	'шкідлив',
	' погано',
	'чіт-міл',
	'читмил',
	'гріх',
	'грішн',
	'провал',
	'заборонен',
	'винн',
	'відпрацю',
	'компенсу',
]

/** A recipe's own heading, lower-case: a short answer must not turn into a recipe. */
const RECIPE_HEADING = '### інгредієнти'
const BLOCK_MARKUP_IN_SHORT = ['###', '\n- ', '\n1. ']

/** 1700 of 2000 eaten: a portion of lasagne does not fit, the recipe is still given. */
const DAY_300_LEFT: Partial<FoodParseContext> = {
	...EVENING,
	...DAY_WITH_GOAL,
	dayTotals: { kcal: 1700, protein: 90, fat: 60, carbs: 190 },
	meals: [
		{ type: 'BREAKFAST', kcal: 420 },
		{ type: 'LUNCH', kcal: 820 },
		{ type: 'SNACK', kcal: 460 },
	],
	entries: [
		...(DAY_WITH_GOAL.entries ?? []),
		entry('e6', 'Йогурт з гранолою', 'SNACK', 250, 460, 'yogurt'),
	],
	goal: { dailyKcal: 2000, protein: 140, fat: 70, carbs: 200, remainingKcal: 300 },
}

const COTTAGE_CHEESE: MemoryFoodContext = {
	ref: 'm1',
	name: 'Сир кисломолочний 5%',
	aliases: ['сир'],
	per100g: { kcal: 121, protein: 17, fat: 5, carbs: 3 },
	pieceGrams: null,
	defaultGrams: 200,
	category: 'cottage_cheese',
}

const TREADMILL_10: TodayWorkoutContext = {
	ref: 'w1',
	place: 'GYM',
	time: '19:00',
	lastAt: '19:12',
	finished: false,
	durationMin: null,
	kcalBurned: null,
	exercises: [
		{
			name: 'Доріжка',
			exerciseRef: 'x1',
			muscleGroup: null,
			sets: [],
			durationMin: 10,
			distanceKm: null,
		},
	],
}

/** w1 holds a 10 min treadmill entered 18 minutes ago; «Exercises» knows it as x1. */
const WITH_TREADMILL: Partial<FoodParseContext> = {
	...EVENING,
	workouts: [TREADMILL_10],
	exercises: [
		{
			ref: 'x1',
			name: 'Доріжка',
			kind: 'CARDIO',
			muscleGroup: null,
			last: { date: '2026-10-07', sets: [], durationMin: 10, distanceKm: null },
		},
	],
	history: [
		{ role: 'user', content: 'доріжка 10 хв' },
		{ role: 'assistant', content: 'Записав доріжку: 10 хв.' },
	],
}

/** w1: one bench set 8 × 80 kg, 5 minutes ago. */
const WITH_ONE_BENCH_SET: Partial<FoodParseContext> = {
	...EVENING,
	workouts: [
		{
			ref: 'w1',
			place: 'GYM',
			time: '19:10',
			lastAt: '19:25',
			finished: false,
			durationMin: null,
			kcalBurned: null,
			exercises: [
				{
					name: 'Жим лежачи',
					exerciseRef: 'x1',
					muscleGroup: 'CHEST',
					sets: [{ reps: 8, weightKg: 80, isWarmup: false }],
					durationMin: null,
					distanceKm: null,
				},
			],
		},
	],
	exercises: [
		{
			ref: 'x1',
			name: 'Жим лежачи',
			kind: 'STRENGTH',
			muscleGroup: 'CHEST',
			last: {
				date: '2026-10-07',
				sets: [{ reps: 8, weightKg: 80, isWarmup: false }],
				durationMin: null,
				distanceKm: null,
			},
		},
	],
	history: [
		{ role: 'user', content: 'жим лежачи 80 кг на 8' },
		{ role: 'assistant', content: 'Записав жим лежачи: 80 кг × 8.' },
	],
}

/** What the backend would count for a week (stats-advice.ts formatStatsAdviceNumbers); no weight. */
const WEEK_NUMBERS =
	'7 days 2026-10-01–2026-10-07: logged 6 of 7 days; average 2 160 kcal (goal 2 200), protein 121 g (goal 140 g); in the goal 5 of 6 logged days, over 1'

export const LIVE_CHAT_CASES: EvalCase[] = [
	{
		id: 'format-advice-markup',
		text: 'жим лежачи не росте вже 2 тижні, що робити?',
		context: WITH_ONE_BENCH_SET,
		expect: {
			decision: 'reply',
			replyMatches: ['(^|\\n)(### |- |\\d+\\. )'],
			replyExcludes: JUDGING_STEMS,
		},
		reference:
			'Advice the user asked for may use a heading or a list; the markup violations column (tables, links, code, nested lists, long headings, emoji) is read in the report',
	},
	{
		id: 'format-short-plain',
		text: 'скільки білка лишилось?',
		context: CONTEXT_PRESETS['midday-1240-of-2000'],
		expect: { decision: 'reply', replyExcludes: BLOCK_MARKUP_IN_SHORT },
		reference: 'A one-line answer is plain text: no heading, no list',
	},
	{
		id: 'recipe-full',
		text: 'дай рецепт сирників на 2 порції',
		context: CONTEXT_PRESETS['morning-empty'],
		expect: {
			decision: 'reply',
			replyIncludes: ['### Інгредієнти', '### Як готувати'],
			replyIncludesAny: ['ккал на порцію'],
			replyMatches: ['\\d+\\s*г'],
		},
		reference:
			'Recipes: servings and time, ingredients with grams, numbered steps, one line «≈ N ккал на порцію»; a reply, so nothing is logged',
	},
	{
		id: 'recipe-not-bound',
		text: 'рецепт лазаньї',
		context: DAY_300_LEFT,
		expect: {
			decision: 'reply',
			replyIncludes: ['### Інгредієнти'],
			replyIncludesAny: ['сьогодні'],
		},
		reference:
			'A recipe is not bound by the 300 kcal left; its last sentence says whether a portion fits today',
	},
	{
		id: 'recipe-no-goal',
		text: 'рецепт лазаньї',
		context: EVENING,
		expect: {
			decision: 'reply',
			replyIncludes: ['### Інгредієнти'],
			replyExcludes: ['залишок', 'лишилось', 'залишилось', 'вписується', 'вміститься'],
		},
		reference: 'No goal in the context → the recipe has no «fits today» sentence',
	},
	{
		id: 'recipe-eat-now',
		text: "що з'їсти зараз?",
		context: CONTEXT_PRESETS['evening-1600-of-2000'],
		expect: { decision: 'reply', replyExcludes: [RECIPE_HEADING] },
		reference: '«Що з’їсти зараз?» → 2–3 ideas for the rest of the goal, not a whole recipe',
	},
	{
		id: 'recipe-vague',
		text: 'хочу щось приготувати',
		context: EVENING,
		expect: {
			decision: 'reply',
			replyMatches: ['^[^?]*\\?[^?]*$', '^[\\s\\S]{1,250}$'],
			replyExcludes: [RECIPE_HEADING],
		},
		reference:
			'A vague wish → one short question with options, no recipe yet (one «?», ≤ 250 chars)',
	},
	{
		id: 'recipe-fact-no-fish',
		text: 'дай рецепт вечері з високим вмістом білка',
		context: { ...CONTEXT_PRESETS['evening-1600-of-2000'], facts: ['Не їсть рибу'] },
		expect: {
			decision: 'reply',
			replyIncludes: ['### Інгредієнти'],
			replyExcludes: ['риб', 'тунц', 'лосос', 'сьомг'],
		},
		reference: 'User facts: a recipe never has what the user does not eat',
	},
	{
		id: 'recipe-saved-food-no-log',
		text: 'рецепт сирників з мого сиру',
		context: { ...CONTEXT_PRESETS['morning-empty'], memory: [COTTAGE_CHEESE] },
		expect: {
			decision: 'reply',
			replyIncludes: ['### Інгредієнти'],
			memory: NO_MEMORY_CALLS,
		},
		reference: 'A recipe from a saved food m1: a reply only — no log_food, no memory calls',
	},
	{
		id: 'program-show-card',
		text: 'яка в мене зараз програма?',
		context: WITH_PROGRAM,
		expect: {
			decision: 'reply',
			replyAttach: 'program',
			replyExcludes: ['підход', 'повт'],
		},
		reference:
			'Program rules: attach "program" and one sentence, the exercises and sets stay on the card',
	},
	{
		id: 'program-show-none',
		text: 'яка в мене зараз програма?',
		context: EVENING,
		expect: {
			decision: 'reply',
			replyAttach: null,
			replyIncludesAny: ['нема', 'ще не'],
		},
		reference: 'No active program → say so, attach null (never a card of something else)',
	},
	{
		id: 'tone-no-zryv-echo',
		text: 'вчора зірвався: піца, тортик, чипси',
		expect: {
			decision: 'log_or_clarify',
			logDate: PREVIOUS_DAY,
			replyExcludes: JUDGING_STEMS,
		},
		reference:
			'The user judges themselves; Kusik logs yesterday’s food and names it plainly, without «зрив» or any other judging word',
	},
	{
		id: 'tone-day-judgement',
		text: 'я сьогодні погано їв?',
		context: CONTEXT_PRESETS['evening-over-goal'],
		expect: {
			decision: 'reply',
			replyExcludes: [...JUDGING_STEMS, 'завтра менше'],
		},
		reference: 'Over the goal and asked for a verdict: facts of the day, no verdict words',
	},
	{
		id: 'workout-cardio-no-repeat',
		text: 'все',
		context: WITH_TREADMILL,
		expect: {
			decision: 'workout',
			workouts: [{ appendRef: 'w1', replaceRef: null, finish: true, exercises: [] }],
			replyExcludes: ['не записав', 'не записан', 'не додав'],
		},
		reference:
			'«все» after a treadmill already listed in w1: appendRef + finish, no exercises (no second treadmill), never «not logged»',
	},
	{
		id: 'workout-cardio-asked',
		text: 'доріжку записав?',
		context: WITH_TREADMILL,
		expect: {
			decision: 'reply',
			workouts: [],
			replyExcludes: ['не запис', 'не додав'],
		},
		reference: 'The treadmill is listed in w1: confirm it, log nothing, never «not logged»',
	},
	{
		id: 'workout-cardio-again-then-done',
		text: 'ще 10 хв доріжки, все',
		context: WITH_TREADMILL,
		expect: {
			decision: 'workout',
			workouts: [
				{
					appendRef: 'w1',
					replaceRef: null,
					finish: true,
					exercises: [{ nameIncludes: 'доріж', kind: 'CARDIO', durationMin: 10 }],
				},
			],
		},
		reference:
			'The user says it was done again («ще 10 хв»): one new treadmill of 10 min appended to w1 and the session finished',
	},
	{
		id: 'live-context-same-set',
		text: 'ще один такий самий',
		context: WITH_ONE_BENCH_SET,
		expect: {
			decision: 'workout',
			workouts: [
				{
					appendRef: 'w1',
					replaceRef: null,
					finish: false,
					exercises: [{ nameIncludes: 'жим', sets: 1, reps: 8, weightKg: 80, exerciseRef: 'x1' }],
				},
			],
		},
		reference:
			'«Ще один такий самий» after one logged set: appendRef w1, the same exercise x1, one set 8 × 80',
	},
	{
		id: 'stats-advice',
		text: 'підсумок за тиждень і дай поради',
		expect: {
			decision: 'stats',
			stats: { days: 7 },
			statsAdvice: true,
			statsNumbers: WEEK_NUMBERS,
			replyExcludes: [...JUDGING_STEMS, ' вага', ' вагу', ' ваги', ' кг'],
		},
		reference:
			'Summary + advice: show_stats days 7 with advice true; the second call gets the counted numbers and answers with advice, no judging words, no weight',
	},
]
