// Range references: home dishes and portions "by eye". Bounds = plausible small…large portion
// with typical recipes; the error is 0 inside the range.
import { range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

export const RANGE_CASES: EvalCase[] = [
	{
		id: 'eggs-and-buckwheat',
		text: '3 варені яйця і 100 г гречки',
		expect: {
			decision: 'log_or_clarify',
			kcal: range(292, 412),
			protein: range(19.8, 27),
			categories: ['eggs', 'porridge'],
		},
		reference:
			'Eggs 50–60 g edible × 3 at 155 kcal/12.6 g P per 100 g (USDA); buckwheat cooked 92–132 kcal (USDA 92, UA tables up to ~130); may ask cooked vs dry',
	},
	{
		id: 'buckwheat-cooked',
		text: '100 г вареної гречки',
		expect: {
			decision: 'log',
			kcal: range(92, 132),
			protein: range(3.4, 4.6),
			categories: ['porridge'],
		},
		reference:
			'Cooked buckwheat: USDA 92 kcal, UA/PL tables 100–132 kcal per 100 g; cooked is stated → no question',
	},
	{
		id: 'banana-piece',
		text: 'банан',
		expect: {
			decision: 'log',
			kcal: range(85, 125),
			protein: range(1, 1.6),
			categories: ['banana'],
		},
		reference: 'Medium–large banana 100–136 g edible × 89 kcal (USDA)',
	},
	{
		id: 'apple-piece',
		text: 'яблуко',
		expect: { decision: 'log', kcal: range(65, 115), categories: ['fruit'] },
		reference: 'Apple 130–220 g × 52 kcal (USDA)',
	},
	{
		id: 'rye-bread',
		text: '2 скибки житнього хліба',
		expect: { decision: 'log', kcal: range(140, 210), protein: range(4, 8), categories: ['bread'] },
		reference: 'Slices 28–40 g × 2 at ~250–260 kcal per 100 g',
	},
	{
		id: 'kefir-glass',
		text: 'склянка кефіру',
		expect: { decision: 'log', kcal: range(95, 160), protein: range(7, 9.5), categories: ['milk'] },
		reference: '250 ml at 38–64 kcal per 100 ml (1–3.2 % fat)',
	},
	{
		id: 'cappuccino',
		text: 'капучино',
		expect: { decision: 'log', kcal: range(60, 170), categories: ['coffee'] },
		reference: '200–350 ml cup with milk; borderline: coffee, not milk',
	},
	{
		id: 'tea-sugar',
		text: 'чай з двома ложками цукру',
		expect: { decision: 'log', kcal: range(25, 45), categories: ['tea'] },
		reference: '2 tsp sugar 8–10 g × 4 kcal, tea ~0',
	},
	{
		id: 'varenyky',
		text: '10 вареників з картоплею',
		expect: { decision: 'log_or_clarify', kcal: range(380, 700), categories: ['dumplings'] },
		reference: '25–35 g each, 150–200 kcal per 100 g; borderline: dumplings, not potatoes',
	},
	{
		id: 'syrnyky',
		text: '3 сирники зі сметаною',
		expect: { decision: 'log_or_clarify', kcal: range(400, 750), categories: ['pancakes'] },
		reference:
			'60–80 g each at 200–260 kcal per 100 g + 20–40 g sour cream; borderline: pancakes, not cottage cheese',
	},
	{
		id: 'shawarma',
		text: 'шаурма',
		expect: { decision: 'log_or_clarify', kcal: range(500, 900), categories: ['fast_food'] },
		reference: '300–450 g wrap at 170–220 kcal per 100 g',
	},
	{
		id: 'pizza-slices',
		text: '2 шматки піци пепероні',
		expect: { decision: 'log_or_clarify', kcal: range(450, 750), categories: ['pizza'] },
		reference: '1/8 of a 30–35 cm pizza ≈ 230–370 kcal per slice',
	},
	{
		id: 'oatmeal-milk',
		text: 'тарілка вівсянки на молоці',
		expect: { decision: 'log_or_clarify', kcal: range(220, 420), categories: ['porridge'] },
		reference: '250–350 g at 90–120 kcal per 100 g',
	},
	{
		id: 'caesar',
		text: 'салат цезар з куркою',
		expect: { decision: 'log_or_clarify', kcal: range(300, 650), categories: ['salad'] },
		reference: '250–350 g restaurant portion at 120–190 kcal per 100 g',
	},
	{
		id: 'olivier',
		text: "200 г олів'є",
		expect: { decision: 'log', kcal: range(290, 420), categories: ['salad'] },
		reference: 'Weighed, but recipes vary: 145–210 kcal per 100 g',
	},
	{
		id: 'milk-chocolate',
		text: 'плитка молочного шоколаду 100 г',
		expect: {
			decision: 'log',
			kcal: range(520, 560),
			protein: range(6.5, 9),
			categories: ['chocolate'],
		},
		reference: 'USDA milk chocolate 535 kcal; EU bars 530–560',
	},
	{
		id: 'walnuts-handful',
		text: 'жменя волоських горіхів',
		expect: { decision: 'log', kcal: range(150, 260), categories: ['nuts'] },
		reference: '25–40 g × 654 kcal per 100 g (USDA)',
	},
	{
		id: 'beer',
		text: 'пляшка пива 0.5',
		expect: { decision: 'log', kcal: range(190, 250), categories: ['alcohol'] },
		reference: '500 ml lager 4.5–5 %: 39–48 kcal per 100 ml',
	},
	{
		id: 'wine-glass',
		text: 'келих червоного вина',
		expect: { decision: 'log', kcal: range(100, 170), categories: ['alcohol'] },
		reference: '125–200 ml × 85 kcal per 100 ml (USDA)',
	},
	{
		id: 'burger-fries',
		text: 'бургер і середня картопля фрі',
		expect: { decision: 'log_or_clarify', kcal: range(750, 1300), categories: ['fast_food'] },
		reference: 'Burger 450–800 + medium fries 300–450 kcal',
	},
	{
		id: 'hot-dog',
		text: 'хот-дог',
		expect: { decision: 'log', kcal: range(250, 480), categories: ['fast_food'] },
		reference: 'Bun + sausage + sauces',
	},
	{
		id: 'omelette',
		text: 'омлет з 2 яєць',
		expect: {
			decision: 'log',
			kcal: range(150, 280),
			protein: range(12, 17),
			categories: ['eggs'],
		},
		reference: '2 eggs ≈ 140 kcal, 12.6 g P + 0–10 g butter/oil and a splash of milk',
	},
	{
		id: 'borscht-plate',
		text: 'тарілка борщу',
		expect: { decision: 'log_or_clarify', kcal: range(150, 380), categories: ['borscht'] },
		reference: '300–400 g at 45–70 kcal per 100 g, ± sour cream and meat',
	},
	{
		id: 'cottage-cheese-sour-cream',
		text: '200 г кисломолочного сиру 5 % зі столовою ложкою сметани',
		expect: {
			decision: 'log',
			kcal: range(260, 360),
			protein: range(30, 38),
			categories: ['cottage_cheese'],
		},
		reference:
			'Twaróg 5 % ~121 kcal, 17 g P per 100 g + 15–25 g sour cream 15–20 %; borderline: cottage_cheese',
	},
	{
		id: 'orange-juice',
		text: 'склянка апельсинового соку',
		expect: { decision: 'log', kcal: range(100, 125), categories: ['juice'] },
		reference: '250 ml × 45 kcal per 100 ml (USDA)',
	},
	{
		id: 'grilled-chicken-thigh',
		text: 'курка гриль, одне стегно',
		expect: { decision: 'log', kcal: range(200, 400), categories: ['poultry'] },
		reference:
			'Thigh with skin 120–180 g edible × 210–230 kcal; borderline: poultry, not fast_food',
	},
]
