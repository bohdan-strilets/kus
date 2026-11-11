// Read tools (0.11.0): find_food over the user's saved foods and the last 90 days of entries, the
// passive «Saved foods» block that now names a food by any spelling, and the markers that tell the
// model who changed what. Fixtures are made up (the structure follows real chat messages). The runner
// answers find_food from `savedFoods` and `historyEntries` with the backend's own functions.
// Clock: Wed 2026-10-07.
import { entry, exact, NO_MEMORY_CALLS, range } from './case-builders.js'
import type { EvalCase, HistoryEntryFixture } from './case.types.js'
import { savedFood } from '../read-fixtures.js'

const SPORTYFEEL = savedFood({
	name: 'Батончик SportyFeel',
	per100g: { kcal: 376, protein: 33, fat: 12, carbs: 30 },
	pieceGrams: 45,
	category: 'protein_bar',
	usageCount: 7,
})

const SPORTYFEEL_LONG = savedFood({
	name: 'Протеїновий батончик SportyFeel',
	per100g: { kcal: 376, protein: 33, fat: 12, carbs: 30 },
	pieceGrams: 45,
	category: 'protein_bar',
	usageCount: 7,
})

const OLIMP = savedFood({
	name: 'Протеїновий батончик Olimp',
	per100g: { kcal: 360, protein: 30, fat: 11, carbs: 33 },
	pieceGrams: 60,
	category: 'protein_bar',
	usageCount: 2,
})

const BUCKWHEAT = savedFood({
	name: 'Гречка варена',
	aliases: ['гречка'],
	per100g: { kcal: 110, protein: 4, fat: 1.1, carbs: 21 },
	defaultGrams: 200,
	category: 'porridge',
	usageCount: 12,
})

const MILK = savedFood({
	name: 'Молоко 2%',
	per100g: { kcal: 51, protein: 3.4, fat: 2, carbs: 4.7 },
	defaultGrams: 250,
	category: 'milk',
	usageCount: 20,
})

/** One bar among the saved foods: «прот батончик» names only half of its name, so the passive block misses it. */
export const ONE_BAR_FOODS = [SPORTYFEEL, BUCKWHEAT, MILK]

const PROTEIN_BAR_HISTORY: HistoryEntryFixture[] = [
	{
		date: '2026-10-05',
		mealType: 'SNACK',
		name: 'Протеїновий батончик SportyFeel',
		grams: 45,
		kcal: 170,
		source: 'LABEL',
		count: 3,
	},
	{
		date: '2026-09-28',
		mealType: 'LUNCH',
		name: 'Курка гриль',
		grams: 150,
		kcal: 240,
		source: 'ESTIMATE',
		count: 4,
	},
]

const FACT_NO_FISH = 'Не їсть рибу'
const FACT_TUESDAYS = 'Тренується по вівторках'

const PIZZA = { ref: 'e1', name: 'Піца маргарита', grams: 250, kcal: 640 }

/** The reply must not deny a record that existed, nor confess to a mistake that was not made. */
const NO_DENIAL = [
	'не записував',
	'не додавав',
	'нічого не записав',
	'збрехав',
	'вибач',
	'моя помилка',
]

const BAR_ASKED_HISTORY = [
	{ role: 'user' as const, content: 'Додай прот батончик' },
	{
		role: 'assistant' as const,
		content: 'Протеїнового батончика в памʼяті не бачу: напиши назву чи цифри з упаковки.',
	},
]

export const READ_TOOL_CASES: EvalCase[] = [
	{
		id: 'read-sportyfeel-exact',
		text: 'Sportyfeel',
		savedFoods: ONE_BAR_FOODS,
		context: { history: BAR_ASKED_HISTORY },
		expect: { decision: 'log_or_clarify', memoryRefs: ['m1'], findFoodCalled: false },
		reference:
			'The brand alone, as the answer to «не бачу»: the passive block already carries it as m1 → logged from it, no lookup',
	},
	{
		id: 'read-translit-cyr',
		text: 'додай спортіфіл на сніданок',
		savedFoods: ONE_BAR_FOODS,
		expect: { decision: 'log_or_clarify', memoryRefs: ['m1'], findFoodCalled: false },
		reference: 'A Cyrillic spelling of the Latin brand finds the saved bar: m1, no lookup',
	},
	{
		id: 'read-prot-bar-abbrev',
		text: 'Він має іншу назву, пошукай',
		savedFoods: ONE_BAR_FOODS,
		context: { history: BAR_ASKED_HISTORY },
		expect: { decision: 'log_or_clarify', findFoodCalled: true, memoryRefs: ['m1'] },
		reference:
			'#72/#73: «прот батончик» was in the previous turn; this message has no food word, so the passive block is empty — find_food("батончик") finds the saved bar and it is logged from the memory (m1)',
	},
	{
		id: 'read-show-memory-list',
		text: 'покажи, які протеїнові батончики в мене збережені',
		savedFoods: [SPORTYFEEL, OLIMP, BUCKWHEAT, MILK],
		expect: {
			decision: 'reply',
			replyMatches: ['^(?=[\\s\\S]*[Ss]porty[Ff]eel)(?=[\\s\\S]*[Oo]limp)'],
			replyExcludes: ['не можу', 'не бачу'],
			memory: NO_MEMORY_CALLS,
		},
		reference:
			"A question about the memory is answered from it (the block or find_food), both bars named; no «can't see the list»",
	},
	{
		id: 'read-last-protein-bar',
		text: 'Додай останній протеїновий батончик',
		savedFoods: [BUCKWHEAT, MILK],
		historyEntries: PROTEIN_BAR_HISTORY,
		expect: {
			decision: 'log_or_clarify',
			findFoodCalled: true,
			copyRefs: ['h1'],
			kcal: range(165, 180),
		},
		reference:
			'«Останній батончик» is in the history, not the saved foods: find_food (history) → copyRef h1, 170 kcal of the earlier entry',
	},
	{
		id: 'read-last-time-170',
		text: 'Останній раз ти писав 170 калорій',
		savedFoods: [BUCKWHEAT, MILK],
		historyEntries: PROTEIN_BAR_HISTORY,
		context: {
			entries: [entry('e1', 'Протеїновий батончик', 'SNACK', 45, 210, 'protein_bar')],
			history: [
				{ role: 'user', content: 'Додай останній протеїновий батончик', loggedRefs: ['e1'] },
				{ role: 'assistant', content: 'Додав батончик: 45 г, 210 ккал.' },
			],
		},
		expect: {
			decision: 'edit',
			findFoodCalled: true,
			edits: { corrected: [{ ref: 'e1', kcal: exact(170) }] },
			replyExcludes: ['не бачу', 'не знайш'],
		},
		reference:
			'The user remembers an earlier entry: the model looks it up (history), sees 170 kcal and corrects e1 to it instead of «не бачу такого запису»',
	},
	{
		id: 'read-typo-i',
		text: 'додай протеіновий батончик',
		savedFoods: [SPORTYFEEL_LONG, BUCKWHEAT, MILK],
		expect: { decision: 'log_or_clarify', memoryRefs: ['m1'] },
		reference:
			'і for ї: the saved «Протеїновий батончик SportyFeel» is found either way (block or lookup) and used as m1',
	},
	{
		id: 'read-no-match-honest',
		text: 'Додай мій йогурт Piątnica',
		savedFoods: ONE_BAR_FOODS,
		historyEntries: PROTEIN_BAR_HISTORY,
		expect: {
			decision: 'log_or_clarify',
			memory: NO_MEMORY_CALLS,
			findFoodCalled: true,
			memoryRefs: [],
			copyRefs: [],
			sources: ['ESTIMATE', 'REFERENCE'],
			replyIncludesAny: ['памʼят', "пам'ят", 'не знайш', 'не бачу', 'немає'],
			replyExcludes: ['не можу додати', 'не буду додавати', 'не додаю'],
		},
		reference:
			'Nothing in the memory or the history matches (find_food finds no candidate): log_food with an honest estimate, no memory or copy ref, no source MEMORY; the reply says there is no such food in the memory and does not refuse to log',
	},
	{
		id: 'read-plain-banana-no-find',
		text: "з'їв банан 120 г",
		savedFoods: ONE_BAR_FOODS,
		expect: {
			decision: 'log',
			kcal: range(95, 125),
			findFoodCalled: false,
			memoryRefs: [],
		},
		reference:
			'An ordinary food is logged straight away: find_food is not called, a lookup costs a round',
	},
	{
		id: 'read-deleted-by-user-not-mine',
		text: 'ти ж записав піцу?',
		context: {
			deletedEntries: [PIZZA],
			history: [
				{
					role: 'user',
					content: 'на вечерю 2 шматки піци маргарита',
					loggedRefs: ['e1'],
					deletedLoggedRefs: ['e1'],
					deletedInAppLoggedRefs: ['e1'],
				},
				{ role: 'assistant', content: 'Записав піцу маргарита: 250 г, 640 ккал.' },
			],
		},
		expect: {
			decision: 'reply',
			replyIncludesAny: ['застосун', 'додатк', 'сам', 'видален', 'видалив'],
			replyExcludes: NO_DENIAL,
		},
		reference:
			'The pizza was logged and then deleted in the app ([deleted later in the app]): it was recorded, the user removed it; no «I did not record it», no apology',
	},
	{
		id: 'read-restored-by-kusik',
		text: 'Ти записав?',
		context: {
			entries: [entry('e1', 'Банан', 'SNACK', 120, 107, 'banana')],
			history: [
				{ role: 'user', content: 'поверни банан' },
				{
					role: 'assistant',
					content: 'Повернув банан у сьогоднішні записи.',
					kusikActions: { deleted: [], restored: [{ ref: 'e1' }], corrected: [] },
				},
			],
		},
		expect: {
			decision: 'reply',
			replyIncludesAny: ['так', 'повернув', 'є в записах', 'на місці'],
			replyExcludes: ['не зробив', 'насправді нічого', 'моя помилка', 'вибач', 'збрехав'],
		},
		reference:
			"The banana was restored by Kusik in the turn marked [Kusik: restored e1] and is in today's entries: confirm, no restore again, no confession",
	},
	{
		id: 'read-copy-today-to-tomorrow',
		text: 'Додай на завтра на сніданок таку саму порцію пластівців як сьогодні',
		context: {
			entries: [entry('e1', 'Пластівці шоколадно-карамельні', 'BREAKFAST', 60, 243, 'cereal')],
		},
		savedFoods: ONE_BAR_FOODS,
		expect: {
			decision: 'log',
			logDate: '2026-10-08',
			copyRefs: ['e1'],
			kcal: exact(243),
			findFoodCalled: false,
		},
		reference:
			"«Така сама порція як сьогодні» points at today's entry e1: copyRef e1 for tomorrow (2026-10-08), no lookup",
	},
	{
		id: 'read-again-soup-today',
		text: 'Додай ще раз бульйон 600г',
		context: {
			entries: [entry('e1', 'Суп курячий з макаронами', 'LUNCH', 850, 425, 'soup')],
			earlier: [
				{
					ref: 'h1',
					date: '2026-09-20',
					mealType: 'DINNER',
					name: 'Суп-бульйон з індичкою',
					grams: 600,
					kcal: 210,
				},
			],
		},
		historyEntries: [
			{
				date: '2026-09-20',
				mealType: 'DINNER',
				name: 'Суп-бульйон з індичкою',
				grams: 600,
				kcal: 210,
				source: 'ESTIMATE',
			},
		],
		expect: {
			decision: 'log_or_reply',
			copyRefsAnyOf: [['e1'], []],
			findFoodCalled: false,
		},
		reference:
			"«Ще раз» a soup that is in today's entries (e1) while an old, similarly named one (h1) sits in the earlier list: the model copies today's e1 or asks which broth; never h1 of another day; no lookup",
	},
	{
		id: 'read-marker-not-in-unrelated-answer',
		text: "Які батончики є в пам'яті?",
		savedFoods: [SPORTYFEEL, OLIMP, BUCKWHEAT, MILK],
		context: {
			appChanges: [
				{
					kind: 'deleted',
					ref: 'e7',
					name: 'Протеїновий батончик',
					localDate: '2026-10-07',
				},
			],
		},
		expect: {
			decision: 'reply',
			replyMatches: ['^(?=[\\s\\S]*[Ss]porty[Ff]eel)(?=[\\s\\S]*[Oo]limp)'],
			replyExcludes: ['видален', 'в застосунку', 'прибран'],
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'The message carries [in the app before this message: deleted e7 "Протеїновий батончик"], but the question is about the saved foods: both bars are listed and the app change is not mentioned',
	},
	{
		id: 'memory-list-all',
		text: "що в мене в пам'яті?",
		savedFoods: [OLIMP, BUCKWHEAT, MILK],
		context: { facts: [FACT_NO_FISH, FACT_TUESDAYS] },
		expect: {
			decision: 'reply',
			findFoodCalled: true,
			replyMatches: [
				'^(?=[\\s\\S]*[Oo]limp)(?=[\\s\\S]*[Гг]речк)(?=[\\s\\S]*[Мм]олок)(?=[\\s\\S]*([Рр]иб|[Вв]івтор))',
			],
			replyExcludes: ['не бачу', 'не можу'],
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'Bug 2026-11-10: «що в мене в памʼяті?» got «не бачу збережених продуктів». With no kind of food, find_food scope saved without a query lists the whole memory; the reply names the foods (Olimp, buckwheat, milk) and at least one fact from «User facts»',
	},
	{
		id: 'memory-list-foods-only',
		text: 'які продукти в мене збережені?',
		savedFoods: [OLIMP, BUCKWHEAT, MILK],
		context: { facts: [FACT_NO_FISH, FACT_TUESDAYS] },
		expect: {
			decision: 'reply',
			findFoodCalled: true,
			replyMatches: ['^(?=[\\s\\S]*[Oo]limp)(?=[\\s\\S]*[Гг]речк)(?=[\\s\\S]*[Мм]олок)'],
			replyExcludes: ['не бачу', 'не можу'],
			replyExcludesWords: ['риб', 'вівтор'],
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'Only the foods are asked: the saved foods are listed from find_food (scope saved), the facts of «User facts» are not mixed in',
	},
]
