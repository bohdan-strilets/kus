// A whole day in one message (9–12 items): long answers, many items, memory-free. Added after
// real day messages were cut at max_tokens 2000. Bounds = sum of per-item bounds (see reference).
import { range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

export const DAY_CASES: EvalCase[] = [
	{
		id: 'day-weighed',
		text: 'За день: 60 г вівсяних пластівців на воді, 150 г грецького йогурту 2 %, банан 120 г, 200 г вареного рису, 150 г запеченого курячого філе, 200 г броколі на пару, 10 г оливкової олії, 30 г мигдалю, яблуко 180 г',
		expect: {
			decision: 'log',
			kcal: range(1290, 1480),
			protein: range(82, 97),
			categories: ['porridge', 'yogurt', 'banana', 'poultry', 'vegetables', 'nuts', 'fruit'],
		},
		reference:
			'All weighed, USDA per 100 g: 233 + 110 + 107 + 260 + 248 + 70 + 88 + 174 + 94 = 1383 kcal, 90 g protein; ±7 % for table differences',
	},
	{
		id: 'day-mixed-label',
		text: 'Сьогодні: омлет з 3 яєць, 2 скибки житнього хліба, капучино; на обід 300 г вареної гречки і 2 сосиски; протеїновий батончик 60 г (на 100 г 360 ккал, білок 33 г, жири 12, вуглеводи 30); на вечерю 200 г запеченого лосося і 200 г вареної картоплі; кефір 2 % 250 мл',
		expect: {
			decision: 'log_or_clarify',
			kcal: range(1767, 2522),
			protein: range(125, 160),
			categories: [
				'eggs',
				'bread',
				'coffee',
				'porridge',
				'sausage',
				'protein_bar',
				'fish',
				'potatoes',
				'milk',
			],
		},
		reference:
			'Omelette 220–380, bread 140–210, cappuccino 60–170, buckwheat 276–396, 2 sausages 220–400, bar 216 (label), salmon 360–420, potatoes 160–190, kefir 115–140',
	},
	{
		id: 'day-by-eye',
		text: 'Сніданок: вівсянка на молоці, банан, кава з молоком. Обід: борщ, 2 скибки хліба, котлета з пюре. Перекус: йогурт і жменя горіхів. Вечеря: 150 г курячого філе, гречка, салат з огірків',
		expect: {
			decision: 'log_or_clarify',
			kcal: range(1615, 2945),
			categories: ['porridge', 'banana', 'borscht', 'meat', 'poultry'],
		},
		reference:
			'Oatmeal 220–420, banana 85–125, coffee 20–80, borscht 150–380, bread 140–210, cutlet 200–330, mash 150–280, yogurt 90–180, nuts 150–260, chicken 230–260, buckwheat 150–300, salad 30–120',
	},
]
