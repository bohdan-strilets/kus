// «Чужі голоси» (0.8.0): made-up people who write unlike the author — surzhyk with typos, Polish,
// Russian, a teenager with emoji, voice dictation without punctuation, a long polite text, uk/pl
// mixed, a terse gym-goer. Kusik must get the intent, answer in the message's language and never
// name the user's gender (checked on every reply by reply-report.ts). Clock: Wed 2026-10-07.
import { range } from './case-builders.js'
import type { EvalCase } from './case.types.js'
import { CONTEXT_PRESETS } from './context-presets.js'

const EVENING = CONTEXT_PRESETS['evening-1600-of-2000']
const MIDDAY = CONTEXT_PRESETS['midday-1240-of-2000']

/** «Nothing to help with» was a prod answer to «suggest a dinner». */
const NO_BRUSH_OFF = ['не можу допомогти', 'нема з чим', 'немає з чим', 'не можу порадити']

export const FOREIGN_VOICE_CASES: EvalCase[] = [
	{
		id: 'voice-surzhyk-log',
		text: 'сйодня на обід був борщь і два кусочка хліба',
		expect: { decision: 'log', kcal: range(300, 560), categories: ['borscht', 'bread'] },
		reference:
			'Borscht 300–450 g × 45–75 kcal + 2 slices 28–45 g × 250 kcal (USDA / UA tables); range set by the author',
	},
	{
		id: 'voice-surzhyk-sweet',
		text: 'а можна мені шось солоденьке щас чи вже перебор?',
		context: EVENING,
		expect: { decision: 'reply', replyIncludes: ['400'] },
		reference: 'A question, not a meal: remainder 400 from the context (2000 − 1600)',
	},
	{
		id: 'voice-surzhyk-dinner',
		text: 'шо б таке на вечерю зїсти щоб не перебрать',
		context: EVENING,
		expect: { decision: 'reply', replyExcludes: NO_BRUSH_OFF },
		reference: 'Out of the categories: a dinner idea that fits the 400 kcal left',
	},
	{
		id: 'voice-surzhyk-coffee',
		text: 'кофе с молоком без сахара',
		expect: { decision: 'log', kcal: range(25, 90), categories: ['coffee'] },
		reference: 'Cup 200–250 ml with 50–100 ml of 2.5 % milk, no sugar',
	},
	{
		id: 'voice-pl-log',
		text: 'zjadlam owsianke na mleku i banana',
		expect: {
			decision: 'log',
			kcal: range(320, 520),
			categories: ['porridge', 'banana'],
			replyLang: 'pl',
		},
		reference:
			'Polish without diacritics: oatmeal on milk 250–300 g × 90–130 + banana 100–136 g × 89 (USDA)',
	},
	{
		id: 'voice-pl-kebab-question',
		text: 'ile kalorii ma kebab w bułce?',
		expect: { decision: 'reply', replyLang: 'pl' },
		reference: 'A question, nothing eaten: answer in Polish, log nothing',
	},
	{
		id: 'voice-pl-remaining',
		text: 'ile jeszcze mogę dziś zjeść?',
		context: MIDDAY,
		expect: { decision: 'reply', replyIncludes: ['760'], replyLang: 'pl' },
		reference: 'Remainder from the context (2000 − 1240), in Polish',
	},
	{
		id: 'voice-pl-pierogi',
		text: 'na obiad pierogi ruskie, 8 sztuk',
		expect: {
			decision: 'log',
			kcal: range(450, 900),
			categories: ['dumplings'],
			replyLang: 'pl',
		},
		reference: '8 × 30–50 g at 190–230 kcal per 100 g (PL tables); range set by the author',
	},
	{
		id: 'voice-pl-stats-two-weeks',
		text: 'jak mi poszło przez ostatnie 2 tygodnie?',
		expect: { decision: 'stats', stats: { days: 14 }, replyLang: 'pl' },
		reference: 'Any period: 14 days ending today, the words in Polish',
	},
	{
		id: 'voice-ru-stats-ten-days',
		text: 'покажи как я ел за последние 10 дней',
		expect: { decision: 'stats', stats: { days: 10 }, replyLang: 'ru' },
		reference: 'Any period: 10 days ending today, the words in Russian',
	},
	{
		id: 'voice-ru-cutlets',
		text: 'съел две котлеты с пюре на ужин',
		expect: {
			decision: 'log',
			kcal: range(500, 950),
			categories: ['meat', 'potatoes'],
			replyLang: 'ru',
		},
		reference: 'Cutlets 2 × 80–120 g × 220–260 + mash 200–250 g × 90–130',
	},
	{
		id: 'voice-ru-buckwheat-question',
		text: 'можно ли есть гречку вечером?',
		expect: { decision: 'reply', replyLang: 'ru' },
		reference: 'A question: answer in Russian, log nothing',
	},
	{
		id: 'voice-ru-dinner',
		text: 'что мне поесть на ужин, чтобы влезть в норму?',
		context: EVENING,
		expect: { decision: 'reply', replyLang: 'ru', replyExcludes: NO_BRUSH_OFF },
		reference: 'A dinner idea for the 400 kcal left, in Russian',
	},
	{
		id: 'voice-teen-shawarma',
		text: 'бро я схомячив 2 шаурми 🌯🌯 і колу 0.5 😅',
		expect: { decision: 'log', kcal: range(1100, 1700), categories: ['fast_food', 'soda'] },
		reference: 'Shawarma 2 × 450–750 kcal + cola 500 ml × 42 kcal; range set by the author',
	},
	{
		id: 'voice-teen-hello',
		text: 'йоу 👋 шо ти вмієш?',
		expect: { decision: 'reply' },
		reference: 'Small talk: say what Kusik does, log nothing',
	},
	{
		id: 'voice-teen-chips',
		text: 'пачка чіпсів лейс 🥔 маленька',
		expect: { decision: 'log_or_clarify', kcal: range(250, 450), categories: ['snacks'] },
		reference: 'Small pack 45–80 g × 536 kcal (label)',
	},
	{
		id: 'voice-dictation-breakfast',
		text: 'на сніданок два яйця варених хліб з маслом і чай з цукром одна ложка',
		expect: { decision: 'log', kcal: range(250, 420), categories: ['eggs', 'bread', 'tea'] },
		reference: 'Eggs 2 × 70–80 + slice 70–100 + butter 5–10 g + tea with 1 tsp sugar 16–20',
	},
	{
		id: 'voice-dictation-banana-question',
		text: 'скажи будь ласка скільки калорій в банані середньому',
		expect: { decision: 'reply', replyIncludesAny: ['ккал', 'калор'] },
		reference: 'A question about a food: answer, log nothing',
	},
	{
		id: 'voice-dictation-remaining',
		text: 'скільки мені ще лишилось на сьогодні калорій',
		context: MIDDAY,
		expect: { decision: 'reply', replyIncludes: ['760'] },
		reference: 'Remainder from the context, no punctuation in the message',
	},
	{
		id: 'voice-long-morning',
		text: 'Доброго дня. Сьогодні вранці я, як завжди, випила чашку кави з молоком, а потім онука принесла пиріжки з капустою, я з’їла два, бо дуже смачні були. На обід був суп курячий, тарілка, і шматочок хліба.',
		expect: {
			decision: 'log_or_clarify',
			kcal: range(450, 850),
			categories: ['coffee', 'pastry', 'soup', 'bread'],
		},
		reference:
			'Coffee with milk 40–90 + 2 baked pies 60–80 g × 200–250 + chicken soup 300–350 ml × 40–60 + slice 70–100',
	},
	{
		id: 'voice-long-age-question',
		text: 'Скажіть, будь ласка, мені 67 років, чи можна мені худнути і скільки треба їсти, щоб не шкодити собі?',
		expect: { decision: 'reply', replyIncludesAny: ['лікар', 'фахів'] },
		reference: 'Health question at 67: general, gentle, suggest a doctor; no extreme numbers',
	},
	{
		id: 'voice-mix-lunch',
		text: 'на обід zupa pomidorowa і kanapka z serem',
		expect: { decision: 'log', kcal: range(300, 550), categories: ['soup'] },
		reference: 'Tomato soup 300 ml × 35–60 + a cheese sandwich 200–350',
	},
	{
		id: 'voice-mix-eggs-question',
		text: 'чи можна jeść jajka codziennie?',
		expect: { decision: 'reply' },
		reference: 'A question mixing uk/pl: answer, log nothing',
	},
	{
		id: 'voice-gym-shake',
		text: 'протеїн 1 скуп на воді',
		expect: { decision: 'log', kcal: range(100, 140), categories: ['protein_shake'] },
		reference: 'One scoop 30 g of whey ≈ 110–130 kcal, water 0',
	},
	{
		id: 'voice-gym-after',
		text: 'після залу що краще з’їсти?',
		context: EVENING,
		expect: { decision: 'reply', replyExcludes: NO_BRUSH_OFF },
		reference: 'Advice after training within the 400 kcal left; no supplement doses',
	},
	{
		id: 'voice-gym-chicken-rice',
		text: 'курка 200 рис 150 вар',
		expect: { decision: 'log_or_clarify', kcal: range(450, 620) },
		reference: 'Cooked chicken breast 200 g × 150–165 + cooked rice 150 g × 130 (USDA)',
	},
	{
		id: 'voice-emotional',
		text: "сьогодні жахливий день на роботі, хочеться все з'їсти",
		context: EVENING,
		expect: {
			decision: 'reply',
			replyExcludes: ['не можу допомогти', 'забагато', 'не можна'],
		},
		reference: 'Feelings, nothing eaten yet: support and a concrete idea, no ban and no lecture',
	},
	{
		id: 'voice-off-topic',
		text: 'напиши мені резюме для роботи',
		expect: { decision: 'reply', replyExcludes: ['ось резюме'] },
		reference: 'Far from food: a short friendly «not my thing» and what Kusik can help with',
	},
]
