// Workouts (0.8.1): log_workout from the words of a training — sets, reps, weights, cardio —,
// a fix with replaceRef, delete / restore by a w-ref, food and training in one message, the burned
// kcal only when the user says them; plus «як було» / «як спочатку» from the «was:» of the context
// and the gender forms by Address form. Clock: Wed 2026-10-07.
import type { FoodParseContext } from '@kus/shared'

import { atClock, entry, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'
import { CONTEXT_PRESETS } from './context-presets.js'

const SEE_A_SPECIALIST = ['лікар', 'фахів', 'спеціаліст', 'фізіотерап']

const set = (reps: number | null, weightKg: number | null, isWarmup = false) => ({
	reps,
	weightKg,
	isWarmup,
})

const BENCH_85 = {
	name: 'Жим лежачи',
	sets: [set(8, 85), set(8, 85), set(8, 85)],
	durationMin: null,
	distanceKm: null,
}
const TREADMILL_20 = { name: 'Бігова доріжка', sets: [], durationMin: 20, distanceKm: 3 }

/** Today's workout w1: bench 3×8 at 85 and 20 minutes on the treadmill. */
const WITH_WORKOUT: Partial<FoodParseContext> = {
	workouts: [
		{
			ref: 'w1',
			place: 'GYM',
			time: '12:10',
			durationMin: 55,
			kcalBurned: null,
			exercises: [BENCH_85, TREADMILL_20],
		},
	],
	exercises: [
		{
			ref: 'x1',
			name: 'Жим лежачи',
			kind: 'STRENGTH',
			last: {
				date: '2026-10-03',
				sets: [set(8, 77.5), set(8, 77.5), set(8, 77.5)],
				durationMin: null,
				distanceKm: null,
			},
		},
	],
}

/** The dictionary only: the exercise is known, but there is no workout today to confuse a new session with a fix. */
const WITH_DICTIONARY: Partial<FoodParseContext> = { exercises: WITH_WORKOUT.exercises }

const DELETED_WORKOUT: Partial<FoodParseContext> = {
	deletedWorkouts: [
		{
			ref: 'w1',
			place: 'GYM',
			time: null,
			durationMin: 55,
			kcalBurned: null,
			exercises: [BENCH_85],
		},
	],
}

const BORSCHT_CHANGED = {
	...entry('e1', 'Борщ', 'LUNCH', 300, 225, 'borscht', {
		protein: 10,
		fat: 9,
		carbs: 26,
		isEdited: true,
	}),
}

const DAY_WITH_BORSCHT: Partial<FoodParseContext> = {
	dayTotals: { kcal: 225, protein: 10, fat: 9, carbs: 26 },
	meals: [{ type: 'LUNCH', kcal: 225 }],
}

export const WORKOUT_CASES: EvalCase[] = [
	{
		id: 'workout-my-day',
		text: 'зал: доріжка 15 хв, жим 70 3×10, тяга 50 4×10, присід 60 3×8, вело 10 хв',
		expect: {
			decision: 'workout',
			workouts: [
				{
					place: 'GYM',
					kcalBurned: null,
					exercises: [
						{ nameIncludes: 'доріж', kind: 'CARDIO', durationMin: 15 },
						{ nameIncludes: 'жим', kind: 'STRENGTH', sets: 3, weightKg: 70, reps: 10 },
						{ nameIncludes: 'тяг', kind: 'STRENGTH', sets: 4, weightKg: 50, reps: 10 },
						{ nameIncludes: 'присід', kind: 'STRENGTH', sets: 3, weightKg: 60, reps: 8 },
						{ nameIncludes: 'вел', kind: 'CARDIO', durationMin: 10 },
					],
				},
			],
		},
		reference:
			"The author's usual training: cardio + whole-body strength in one session, one workout",
	},
	{
		id: 'workout-three-groups',
		text: 'жим лежачи: 8, 8, 6 по 80',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [{ nameIncludes: 'жим', kind: 'STRENGTH', sets: 3, weightKg: 80, reps: 8 }],
				},
			],
		},
		reference: '«8, 8, 6 по 80» → two groups (8 × 2, 6 × 1), three sets of 80 kg',
	},
	{
		id: 'workout-warmup',
		text: 'жим: розминка 10 по 40, потім 80 3×8',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [{ nameIncludes: 'жим', sets: 4, warmupSets: 1, weightKg: 80, reps: 8 }],
				},
			],
		},
		reference: 'A warm-up set is marked and does not count as the working weight',
	},
	{
		id: 'workout-squat-5x5',
		text: 'присід 100 5х5',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [
						{ nameIncludes: 'присід', kind: 'STRENGTH', sets: 5, weightKg: 100, reps: 5 },
					],
				},
			],
		},
		reference: 'Latin «x» or Cyrillic «х» in 5x5 is the same «sets × reps»',
	},
	{
		id: 'workout-run-outdoors',
		text: 'пробіг 5 км за 31 хв на вулиці',
		expect: {
			decision: 'workout',
			workouts: [
				{
					place: 'OUTDOOR',
					exercises: [{ nameIncludes: 'біг', kind: 'CARDIO', durationMin: 31, distanceKm: 5 }],
				},
			],
		},
		reference: 'Cardio: minutes and kilometres, the place from «на вулиці»',
	},
	{
		id: 'workout-treadmill',
		text: 'доріжка 20 хв, 3 км',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [{ nameIncludes: 'доріж', kind: 'CARDIO', durationMin: 20, distanceKm: 3 }],
				},
			],
		},
		reference: 'Cardio on a machine',
	},
	{
		id: 'workout-bodyweight',
		text: 'підтягування 3×12, віджимання 4×20',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [
						{ nameIncludes: 'підтяг', kind: 'STRENGTH', sets: 3, reps: 12 },
						{ nameIncludes: 'віджим', kind: 'STRENGTH', sets: 4, reps: 20 },
					],
				},
			],
		},
		reference: 'Bodyweight exercises: sets and reps, no weight',
	},
	{
		id: 'workout-two-sessions',
		text: 'зранку пробіг 5 км, ввечері зал: жим 80 3×8',
		context: atClock('2026-10-07 22:10, Wednesday'),
		expect: {
			decision: 'workout',
			workouts: [
				{ exercises: [{ nameIncludes: 'біг', kind: 'CARDIO', distanceKm: 5 }] },
				{ exercises: [{ nameIncludes: 'жим', kind: 'STRENGTH', sets: 3, weightKg: 80, reps: 8 }] },
			],
		},
		reference: 'One log_workout per session: a morning run and an evening gym are two workouts',
	},
	{
		id: 'workout-two-sessions-2',
		text: 'вранці басейн 40 хв, а після роботи зал: жим 70 3×8',
		context: atClock('2026-10-07 22:10, Wednesday'),
		expect: {
			decision: 'workout',
			workouts: [
				// the user's own word («басейн»), not a renamed «плавання»
				{ exercises: [{ nameIncludes: 'басейн', kind: 'CARDIO', durationMin: 40 }] },
				{ exercises: [{ nameIncludes: 'жим', kind: 'STRENGTH', sets: 3, weightKg: 70, reps: 8 }] },
			],
		},
		reference:
			'Another wording of two sessions (a swim in the morning, a gym after work): two log_workout',
	},
	{
		id: 'workout-known-exercise',
		text: 'жим 80 3×8',
		context: WITH_DICTIONARY,
		expect: {
			decision: 'workout',
			workouts: [
				{
					replaceRef: null,
					exercises: [{ nameIncludes: 'жим', sets: 3, weightKg: 80, reps: 8, exerciseRef: 'x1' }],
				},
			],
		},
		reference:
			'The same exercise as in «Exercises» → its x-ref; no workout today, so a new session, not a replace',
	},
	{
		id: 'workout-new-exercise',
		text: 'тяга 50 4×10',
		context: WITH_DICTIONARY,
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [{ nameIncludes: 'тяг', sets: 4, weightKg: 50, reps: 10, exerciseRef: null }],
				},
			],
		},
		reference: 'An exercise that is not in the dictionary gets no exerciseRef',
	},
	{
		id: 'workout-replace',
		text: 'ні, жим був 75',
		context: WITH_WORKOUT,
		expect: {
			decision: 'workout',
			workouts: [
				{
					replaceRef: 'w1',
					exercises: [
						{ nameIncludes: 'жим', sets: 3, weightKg: 75, reps: 8 },
						{ nameIncludes: 'доріж', kind: 'CARDIO', durationMin: 20 },
					],
				},
			],
		},
		reference: 'A fix: replaceRef w1 and the whole workout again with the fix, no second workout',
	},
	{
		id: 'workout-delete',
		text: 'видали тренування',
		context: WITH_WORKOUT,
		expect: { decision: 'edit', edits: { deleted: ['w1'] }, workouts: [] },
		reference: 'delete_entry with the w-ref plus a reply',
	},
	{
		id: 'workout-deleted-hint',
		text: 'видали тренування',
		context: WITH_WORKOUT,
		expect: {
			decision: 'edit',
			edits: { deleted: ['w1'] },
			workouts: [],
			replyIncludesAny: ['поверн'],
			replyExcludes: ['заново'],
		},
		reference:
			'After a delete the reply says it can be brought back with «поверни …», never «запиши заново»',
	},
	{
		id: 'workout-restore',
		text: 'поверни тренування',
		context: DELETED_WORKOUT,
		expect: { decision: 'edit', edits: { restored: ['w1'] }, workouts: [] },
		reference: 'restore_entry with the w-ref from «Deleted today»',
	},
	{
		id: 'workout-food-and-workout',
		text: "жим 80 3×8, а після цього з'їв 200 г сиру",
		expect: {
			decision: 'log_or_clarify',
			kcal: range(150, 900),
			workouts: [
				{ exercises: [{ nameIncludes: 'жим', kind: 'STRENGTH', sets: 3, weightKg: 80, reps: 8 }] },
			],
		},
		reference:
			'«кг» of the bar and food in one message: 80 is the bar, 200 g is the cheese — log_food and log_workout together',
	},
	{
		id: 'workout-food-after-gym',
		text: "після залу з'їв гречку з куркою, 300 г, до того пробіг 3 км",
		expect: {
			decision: 'log_or_clarify',
			kcal: range(300, 600),
			workouts: [{ exercises: [{ nameIncludes: 'біг', kind: 'CARDIO', distanceKm: 3 }] }],
		},
		reference: 'Food and a workout in one message: both tools, each reply covers its own part',
	},
	{
		id: 'workout-burned-400',
		text: 'зал, жим 70 3×10, спалив 400',
		context: CONTEXT_PRESETS['evening-1600-of-2000'],
		expect: {
			decision: 'workout',
			workouts: [{ kcalBurned: 400, exercises: [{ nameIncludes: 'жим', sets: 3, weightKg: 70 }] }],
			replyExcludes: ['до цілі', 'залишил', 'мінус'],
		},
		reference: 'The number the user said is stored; it never moves the goal or what is left today',
	},
	{
		id: 'workout-no-burned-invented',
		text: 'жим 80 3×8',
		expect: {
			decision: 'workout',
			workouts: [{ kcalBurned: null, exercises: [{ nameIncludes: 'жим', sets: 3 }] }],
			replyExcludes: ['ккал', 'спалив'],
		},
		reference: 'No number from the user → kcalBurned null, and the reply talks about no calories',
	},
	{
		id: 'workout-what-to-eat-after-gym',
		text: 'що поїсти після залу?',
		context: CONTEXT_PRESETS['evening-1600-of-2000'],
		expect: {
			decision: 'reply',
			workouts: [],
			replyIncludesAny: ['білок', 'білк', 'кур', 'яйц', 'сир', 'кефір', 'йогурт', 'риб', 'творог'],
			replyExcludes: ['не можу допомогти'],
		},
		reference:
			'A question about training and food → a real answer from what is left of the day (400 kcal)',
	},
	{
		id: 'workout-program-question',
		text: 'як скласти програму на 3 рази на тиждень?',
		expect: { decision: 'reply', workouts: [], replyExcludes: ['не можу допомогти'] },
		reference: 'A training question → reply with advice, nothing logged',
	},
	{
		id: 'workout-knee-pain',
		text: 'болить коліно після присідань, а завтра хочу ще 100 кг на присід, нормально?',
		expect: {
			decision: 'reply',
			workouts: [],
			replyIncludesAny: SEE_A_SPECIALIST,
			replyExcludes: ['потерпи', 'через біль можна', 'розійдеться'],
		},
		reference: 'Pain: do not train through it, a doctor or a physiotherapist; nothing is logged',
	},
	{
		id: 'workout-undo-was',
		text: 'зроби як було',
		context: {
			...DAY_WITH_BORSCHT,
			entries: [
				{ ...BORSCHT_CHANGED, was: { grams: 200, kcal: 150, protein: 7, fat: 6, carbs: 17 } },
			],
		},
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e1', grams: range(195, 205) }] },
		},
		reference: 'correct_entry back to the «was:» values (200 g)',
	},
	{
		id: 'workout-undo-originally',
		text: 'ні, поверни як спочатку',
		context: {
			...DAY_WITH_BORSCHT,
			entries: [
				{
					...BORSCHT_CHANGED,
					was: {
						grams: 200,
						kcal: 150,
						originally: { grams: 150, kcal: 112 },
					},
				},
			],
		},
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e1', grams: range(145, 155) }] },
		},
		reference: '«як спочатку» → the «originally» values (150 g), not the previous ones (200 g)',
	},
	{
		id: 'workout-gender-masculine',
		text: 'я сьогодні дуже втомився після роботи, чи можна пропустити зал?',
		context: { ...DAY_WITH_BORSCHT, addressForm: 'MASCULINE', entries: [BORSCHT_CHANGED] },
		expect: { decision: 'reply', replyExcludes: ['не можу допомогти'] },
		reference:
			'masculine: the user writes about himself; «ти втомився» is right, a feminine form is the mistake',
	},
	{
		id: 'workout-gender-feminine',
		text: 'я сьогодні дуже втомилась після роботи, чи можна пропустити зал?',
		context: { ...DAY_WITH_BORSCHT, addressForm: 'FEMININE', entries: [BORSCHT_CHANGED] },
		expect: { decision: 'reply', replyExcludes: ['не можу допомогти'] },
		reference:
			'feminine: the user writes about herself; «ти втомилась» is right, a masculine form is the mistake',
	},
	{
		id: 'workout-gender-neutral',
		text: 'я сьогодні дуже втомився після роботи, чи можна пропустити зал?',
		context: { ...DAY_WITH_BORSCHT, addressForm: 'NEUTRAL', entries: [BORSCHT_CHANGED] },
		expect: { decision: 'reply', replyExcludes: ['не можу допомогти'] },
		reference:
			'neutral: even if the user writes in the masculine, no gendered form about them in the reply',
	},
	{
		id: 'neutral-no-double-forms',
		text: 'я вже поїв і готовий до тренування, що порадиш?',
		context: { addressForm: 'NEUTRAL' },
		expect: {
			decision: 'reply',
			// the run's gender check (findGenderedForms) reports the same double forms
			replyExcludes: ['(-а)', '(-ла)', '(-ий)', '(а)', '(ла)'],
		},
		reference:
			'Neutral address: no «готовий(-а)» / «поїв(-ла)» double forms, the reply is worded without gender',
	},
]
