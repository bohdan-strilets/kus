// The whole day of the chat (2.1a): the model sees every message of the day, whole. Written before the
// context change was measured: not run yet.
import type { FoodParseContext } from '@kus/shared'

import { savedFood } from '../read-fixtures.js'
import { atClock, entry, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

/** A reply of ~1500 characters whose only question stands in the very last sentence. */
const LONG_REPLY = [
	'На сніданок є кілька варіантів, залежно від того, скільки в тебе часу й що в холодильнику.',
	'Вівсянка на воді з бананом займе п’ять хвилин і дасть близько 300 ккал, вона довго тримає ситість.',
	'Сирники з йогуртом смачні, але їх треба смажити, а це ще 15 хвилин і більше олії.',
	'Йогурт із гранолою — найшвидший варіант, проте гранола часто містить багато цукру, тож дивись на склад.',
	'Тост з авокадо й яйцем — збалансований варіант, у ньому є жири, білок і вуглеводи.',
	'Якщо хочеш більше білка, візьми сир кисломолочний із ягодами, це близько 200 ккал на порцію.',
	'Каша гречана з молоком — звична страва, яка добре насичує на півдня.',
	'Не обов’язково їсти одразу після пробудження: якщо голод приходить пізніше, це нормально.',
	'Головне, щоб сніданок вписувався в твою норму на день і не лишав тебе голодним уже за годину.',
	'Ще можна приготувати щось із того, що в тебе вже є вдома, щоб не витрачати час на магазин.',
	'Вівсянку легко урізноманітнити горіхами, насінням або шматочками фруктів, але стеж за порцією.',
	'Кава з молоком теж додає калорії, тому я б записав її окремо, щоб день виглядав чесно.',
	'Для запису мені достатньо знати лише приблизну вагу, ідеальна точність тут не потрібна.',
	'А ще, якщо ти поспішаєш, достатньо швидко перекусити, а нормальний сніданок лишити на пізніше.',
	'Якщо вчора ти пізно вечеряв, зранку голод може бути слабшим, тоді вистачить чогось легшого.',
	'Фрукти на самоті теж підійдуть, якщо їсти їх разом із чимось білковим.',
	'Тож, схоже, найпростіше для тебе сьогодні — омлет: він швидкий, ситний і добре рахується.',
	'Хочеш, запишу омлет з 3 яєць із сиром ≈ 420 ккал?',
].join(' ')

/** The shape of a live reply: headings, lists, and one question in the very last line. */
const DAY_ANALYSIS = [
	'Підсумок дня: 1 480 ккал із 1 900, лишається 420.',
	'',
	'Що добре',
	'- Білка 139 г із 140 — ціль майже виконана.',
	'- Обід ситний: курка з овочами дала основну частину білка.',
	'- Вуглеводи в межах, 90 г із 190.',
	'',
	'Що можна краще',
	'- Жири 47 г із 84 — низькувато, є куди додати горіхи або оливкову олію.',
	'- Клітковини мало, на вечерю підійде салат або овочі.',
	'- Води в записах не видно.',
	'',
	'На вечерю вистачить приблизно 400 ккал, наприклад омлет з овочами або сир із ягодами.',
	'',
	'Ти з’їв усю страву з курки сьогодні, чи частина лишилась на потім?',
].join('\n')

/** Thursday evening, 1480 of 1900 kcal eaten: the numbers of DAY_ANALYSIS are the numbers of this context. */
const CHICKEN = entry('e5', 'Курка запечена з овочами', 'LUNCH', 650, 835, 'poultry', {
	protein: 100,
	fat: 9.7,
	carbs: 48,
})

const EVENING_DAY: Partial<FoodParseContext> = {
	...atClock('2026-11-12 21:05, Thursday'),
	dayTotals: { kcal: 1480, protein: 139, fat: 47, carbs: 90 },
	meals: [
		{ type: 'BREAKFAST', kcal: 410 },
		{ type: 'LUNCH', kcal: 835 },
		{ type: 'SNACK', kcal: 235 },
	],
	entries: [
		entry('e1', 'Омлет з сиром', 'BREAKFAST', 200, 320, 'eggs', { protein: 22, fat: 26, carbs: 3 }),
		entry('e2', 'Кава з молоком', 'BREAKFAST', 250, 90, 'coffee', { protein: 4, fat: 4, carbs: 8 }),
		entry('e3', 'Йогурт грецький', 'SNACK', 150, 140, 'yogurt', { protein: 12, fat: 7, carbs: 9 }),
		entry('e4', 'Яблуко', 'SNACK', 180, 95, 'fruit', { protein: 0.5, fat: 0.3, carbs: 22 }),
		CHICKEN,
	],
	goal: { dailyKcal: 1900, protein: 140, fat: 84, carbs: 190, remainingKcal: 420 },
	facts: [{ ref: 'f1', text: 'Не їсть рибу' }],
}

const COTTAGE_CHEESE = savedFood({
	name: 'Сир кисломолочний 5%',
	aliases: ['сир'],
	per100g: { kcal: 121, protein: 17, fat: 5, carbs: 3 },
	category: 'cottage_cheese',
	usageCount: 6,
})

const DAY_HISTORY = [
	{ role: 'user' as const, content: 'омлет з 2 яєць і сиром, кава з молоком' },
	{ role: 'assistant' as const, content: 'Записав сніданок. Смачного!' },
	{ role: 'user' as const, content: 'грецький йогурт і яблуко' },
	{ role: 'assistant' as const, content: 'Записав на перекус.' },
	{ role: 'user' as const, content: 'курка запечена з овочами, 650 г' },
	{ role: 'assistant' as const, content: 'Записав обід: 650 г, близько 835 ккал.' },
	{ role: 'user' as const, content: 'як мій день?' },
	{ role: 'assistant' as const, content: DAY_ANALYSIS },
]

const FILLER_PAIRS = [
	['доброго ранку', 'Доброго ранку! Як спалося?'],
	['нормально, дякую', 'Чудово. Що плануєш на сьогодні?'],
	['ще не знаю', 'Нічого, розберемось по ходу дня.'],
	['як там погода', 'Не бачу вікна, на жаль, але сподіваюсь, що сонячно.'],
	['ок, пішов у справах', 'Гарного дня! Пиши, коли щось з’їси.'],
] as const

const toPairs = (pairs: readonly (readonly [string, string])[]) =>
	pairs.flatMap(([user, assistant]) => [
		{ role: 'user' as const, content: user },
		{ role: 'assistant' as const, content: assistant },
	])

export const DAY_HISTORY_CASES: EvalCase[] = [
	{
		id: 'long-reply-proposal-yes',
		text: 'так',
		context: {
			history: [
				{ role: 'user', content: 'що можна на сніданок?' },
				{ role: 'assistant', content: LONG_REPLY },
			],
		},
		expect: { decision: 'log', kcal: range(350, 500), categories: ['eggs'] },
		reference:
			'The proposal «омлет з 3 яєць із сиром ≈ 420 ккал?» is the last sentence of a long reply: «так» confirms it, the omelette is logged (3 eggs and cheese ≈ 350–500 kcal)',
	},
	{
		id: 'day-recall-beyond-six',
		text: 'запиши обід, як казав',
		context: {
			history: [
				...toPairs(FILLER_PAIRS.slice(0, 1)),
				{ role: 'user', content: 'на обід буде гречка 200 г і котлета' },
				{ role: 'assistant', content: 'Смачного! Скажи, коли з’їси, і я запишу.' },
				...toPairs(FILLER_PAIRS.slice(1)),
			],
		},
		expect: {
			decision: 'log',
			minItems: 2,
			itemMeals: [{ stem: 'греч', mealType: 'LUNCH' }],
		},
		reference:
			'Twelve messages into the day, the lunch (buckwheat 200 g and a cutlet) was named in the 2nd user message, beyond the last six: it is logged as LUNCH with both items',
	},
	{
		id: 'short-answer-all',
		text: 'Всю',
		context: { ...EVENING_DAY, history: DAY_HISTORY },
		savedFoods: [COTTAGE_CHEESE],
		expect: {
			decision: 'reply',
			replyExcludes: ['обірв', 'що ти хотів', 'що хотів', 'дописа'],
		},
		reference:
			'A one-word answer to the question at the end of a long day analysis («усю страву чи частина лишилась?») is a complete answer: Kusik takes it as «all of it» and does not ask what the user meant to write (live chat 12.11, 0.12.0)',
	},
	{
		id: 'short-answer-half',
		text: 'Половину',
		context: { ...EVENING_DAY, history: DAY_HISTORY },
		savedFoods: [COTTAGE_CHEESE],
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e5', grams: range(300, 350) }] },
			replyExcludes: ['обірв', 'що ти хотів', 'що хотів', 'дописа'],
		},
		reference:
			'«Половину» answers the same question: the chicken (650 g logged) was half eaten, so the entry is corrected to about 325 g; the one word is not read as a cut-off message',
	},
]
