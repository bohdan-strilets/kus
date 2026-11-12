// The whole day of the chat (2.1a): the model sees every message of the day, whole. Written before the
// context change was measured: not run yet.
import { range } from './case-builders.js'
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
]
