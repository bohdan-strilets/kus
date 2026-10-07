// Exact references: weighed plain products (USDA FoodData Central, SR Legacy, per 100 g)
// and package labels whose numbers are in the message itself.
import { per100 } from './case-builders.js'
import type { EvalCase } from './case.types.js'

const USDA = 'USDA FDC SR Legacy, per 100 g'

export const EXACT_CASES: EvalCase[] = [
	{
		id: 'weighed-banana',
		text: 'банан 120 г',
		expect: {
			decision: 'log',
			kcal: per100(89, 120),
			protein: per100(1.09, 120),
			categories: ['banana'],
		},
		reference: `${USDA}: bananas, raw — 89 kcal, 1.09 g protein`,
	},
	{
		id: 'weighed-apple',
		text: 'яблуко 180 г',
		expect: {
			decision: 'log',
			kcal: per100(52, 180),
			protein: per100(0.26, 180),
			categories: ['fruit'],
		},
		reference: `${USDA}: apples, raw, with skin — 52 kcal, 0.26 g protein`,
	},
	{
		id: 'weighed-chicken-breast',
		text: '150 г курячого філе, запеченого без шкіри',
		expect: {
			decision: 'log',
			kcal: per100(165, 150),
			protein: per100(31, 150),
			categories: ['poultry'],
		},
		reference: `${USDA}: chicken breast, meat only, roasted — 165 kcal, 31.0 g protein`,
	},
	{
		id: 'weighed-rice',
		text: '200 г вареного білого рису',
		expect: {
			decision: 'log',
			kcal: per100(130, 200),
			protein: per100(2.69, 200),
			categories: ['porridge'],
		},
		reference: `${USDA}: rice, white, long-grain, cooked — 130 kcal, 2.69 g protein`,
	},
	{
		id: 'weighed-oats-dry',
		text: '50 г сухих вівсяних пластівців',
		expect: {
			decision: 'log',
			kcal: per100(389, 50),
			protein: per100(16.89, 50),
			categories: ['porridge'],
		},
		reference: `${USDA}: oats — 389 kcal, 16.89 g protein (EU labels 370–380)`,
	},
	{
		id: 'weighed-milk',
		text: 'склянка молока 2 % — 250 мл',
		expect: {
			decision: 'log',
			kcal: per100(50, 250),
			protein: per100(3.3, 250),
			categories: ['milk'],
		},
		reference: `${USDA}: milk, reduced fat 2% — 50 kcal, 3.3 g protein; 1 ml ≈ 1 g`,
	},
	{
		id: 'weighed-olive-oil',
		text: '10 г оливкової олії',
		expect: {
			decision: 'log',
			kcal: per100(884, 10),
			protein: per100(0, 10),
			categories: ['sauce'],
		},
		reference: `${USDA}: olive oil — 884 kcal`,
	},
	{
		id: 'weighed-butter',
		text: '10 г вершкового масла',
		expect: {
			decision: 'log',
			kcal: per100(717, 10),
			protein: per100(0.85, 10),
			categories: ['sauce'],
		},
		reference: `${USDA}: butter, salted — 717 kcal, 0.85 g protein`,
	},
	{
		id: 'weighed-salmon',
		text: '150 г запеченого лосося (з ферми)',
		expect: {
			decision: 'log',
			kcal: per100(206, 150),
			protein: per100(22.1, 150),
			categories: ['fish'],
		},
		reference: `${USDA}: salmon, Atlantic, farmed, cooked, dry heat — 206 kcal, 22.1 g protein`,
	},
	{
		id: 'weighed-potatoes',
		text: '200 г вареної картоплі без шкірки',
		expect: {
			decision: 'log',
			kcal: per100(86, 200),
			protein: per100(1.71, 200),
			categories: ['potatoes'],
		},
		reference: `${USDA}: potatoes, boiled, cooked without skin — 86 kcal, 1.71 g protein`,
	},
	{
		id: 'weighed-almonds',
		text: '30 г мигдалю',
		expect: {
			decision: 'log',
			kcal: per100(579, 30),
			protein: per100(21.15, 30),
			categories: ['nuts'],
		},
		reference: `${USDA}: almonds — 579 kcal, 21.15 g protein`,
	},
	{
		id: 'weighed-greek-yogurt',
		text: '170 г грецького йогурту 2 %',
		expect: {
			decision: 'log',
			kcal: per100(73, 170),
			protein: per100(9.95, 170),
			categories: ['yogurt'],
		},
		reference: `${USDA}: yogurt, Greek, plain, lowfat — 73 kcal, 9.95 g protein`,
	},
	{
		id: 'weighed-pasta-cooked',
		text: '200 г вареної пасти',
		expect: {
			decision: 'log',
			kcal: per100(158, 200),
			protein: per100(5.8, 200),
			categories: ['pasta'],
		},
		reference: `${USDA}: pasta, cooked, enriched — 158 kcal, 5.8 g protein`,
	},
	{
		id: 'weighed-broccoli',
		text: '200 г броколі на пару',
		expect: {
			decision: 'log',
			kcal: per100(35, 200),
			protein: per100(2.38, 200),
			categories: ['vegetables'],
		},
		reference: `${USDA}: broccoli, cooked, boiled — 35 kcal, 2.38 g protein`,
	},
	{
		id: 'weighed-strawberries',
		text: '200 г полуниці',
		expect: {
			decision: 'log',
			kcal: per100(32, 200),
			protein: per100(0.67, 200),
			categories: ['berries'],
		},
		reference: `${USDA}: strawberries, raw — 32 kcal, 0.67 g protein`,
	},
	{
		id: 'weighed-dried-apricots',
		text: '50 г кураги',
		expect: {
			decision: 'log',
			kcal: per100(241, 50),
			protein: per100(3.39, 50),
			categories: ['dried_fruit'],
		},
		reference: `${USDA}: apricots, dried — 241 kcal, 3.39 g protein`,
	},
	{
		id: 'weighed-shrimp',
		text: '150 г варених креветок',
		expect: {
			decision: 'log',
			kcal: per100(99, 150),
			protein: per100(24, 150),
			categories: ['seafood'],
		},
		reference: `${USDA}: shrimp, cooked — 99 kcal, 24.0 g protein`,
	},
	{
		id: 'label-protein-bar',
		text: 'протеїновий батончик 60 г, на етикетці на 100 г: 360 ккал, білок 33 г, жири 12 г, вуглеводи 30 г',
		expect: {
			decision: 'log',
			kcal: per100(360, 60),
			protein: per100(33, 60),
			categories: ['protein_bar'],
		},
		reference: 'Label in the message',
	},
	{
		id: 'label-yogurt',
		text: 'йогурт 150 г, на 100 г: 78 ккал, білки 4.5, жири 2.5, вуглеводи 9.6',
		expect: {
			decision: 'log',
			kcal: per100(78, 150),
			protein: per100(4.5, 150),
			categories: ['yogurt'],
		},
		reference: 'Label in the message',
	},
	{
		id: 'label-skyr',
		text: 'скир 140 г, етикетка: 63 ккал і 11 г білка на 100 г, жири 0.2, вуглеводи 4',
		expect: {
			decision: 'log',
			kcal: per100(63, 140),
			protein: per100(11, 140),
			categories: ['yogurt'],
		},
		reference: 'Label in the message',
	},
	{
		id: 'label-snickers',
		text: 'Snickers 50 г, на етикетці 488 ккал/100 г, білок 8.6, жири 23.6, вуглеводи 60.5',
		expect: {
			decision: 'log',
			kcal: per100(488, 50),
			protein: per100(8.6, 50),
			categories: ['chocolate'],
		},
		reference: 'Label in the message',
	},
	{
		id: 'label-cookies-per-piece',
		text: '2 печива, на пачці: 1 шт (12 г) — 58 ккал, білок 0.8 г, жири 2.6 г, вуглеводи 7.8 г',
		expect: {
			decision: 'log',
			kcal: { exact: 116 },
			protein: { exact: 1.6 },
			categories: ['cookies'],
		},
		reference: 'Label in the message, per piece × 2',
	},
	{
		id: 'label-chips',
		text: 'чіпси 40 г: на 100 г 536 ккал, Б 6.5, Ж 34, В 50',
		expect: {
			decision: 'log',
			kcal: per100(536, 40),
			protein: per100(6.5, 40),
			categories: ['snacks'],
		},
		reference: 'Label in the message',
	},
	{
		id: 'label-rounding-mismatch',
		text: 'батончик 45 г, на етикетці на 100 г: 400 ккал, білок 10 г, жири 10 г, вуглеводи 50 г',
		expect: { decision: 'log', kcal: per100(400, 45), protein: per100(10, 45) },
		reference:
			'Label in the message; kcal is ~20 % above 4/4/9 — label kcal must win, not be rejected',
	},
	{
		id: 'label-kefir',
		text: 'кефір 2 % 400 мл, на 100 мл: 51 ккал, білок 3.4, жири 2, вуглеводи 4.7',
		expect: {
			decision: 'log',
			kcal: per100(51, 400),
			protein: per100(3.4, 400),
			categories: ['milk'],
		},
		reference: 'Label in the message',
	},
	{
		id: 'label-protein-shake',
		text: 'протеїн 30 г на 300 мл молока 2 %. Протеїн на 100 г: 380 ккал, білок 75 г, вуглеводи 8 г, жири 5 г; молоко: 50 ккал і 3.4 г білка на 100 мл',
		expect: {
			decision: 'log',
			kcal: { exact: 264 },
			protein: { exact: 32.7 },
			categories: ['protein_shake'],
		},
		reference:
			'Labels in the message: 114 + 150 kcal, 22.5 + 10.2 g protein; borderline: protein on milk → protein_shake',
	},
	{
		id: 'label-energy-gel',
		text: 'енергетичний гель для бігу 40 г, на 100 г: 250 ккал, вуглеводи 62 г, білок 0, жири 0',
		expect: {
			decision: 'log',
			kcal: per100(250, 40),
			protein: per100(0, 40),
			categories: ['plate'],
		},
		reference: 'Label in the message; no category fits → plate',
	},
	{
		id: 'label-cola',
		text: 'кола 330 мл (42 ккал і 10.6 г цукру на 100 мл)',
		expect: {
			decision: 'log',
			kcal: per100(42, 330),
			protein: per100(0, 330),
			categories: ['soda'],
		},
		reference: 'Label in the message',
	},
]
