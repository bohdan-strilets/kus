// Categories not covered by the kcal cases, plus borderline pairs from design/docs/food-categories.md.
// Category affects only the icon, so it is scored separately from kcal.
import { range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

export const CATEGORY_CASES: EvalCase[] = [
	{
		id: 'cat-cereal',
		text: 'кукурудзяні пластівці з молоком',
		expect: { decision: 'log_or_clarify', categories: ['cereal'] },
		reference: 'food-categories.md: cereal — corn flakes with milk',
	},
	{
		id: 'cat-toast',
		text: 'бутерброд з сиром і шинкою',
		expect: { decision: 'log', kcal: range(200, 400), categories: ['toast'] },
		reference: 'Bread 40–60 g + cheese 20–30 g + ham 20–30 g (+ butter)',
	},
	{
		id: 'cat-pastry',
		text: 'круасан',
		expect: { decision: 'log', kcal: range(230, 400), categories: ['pastry'] },
		reference: '57–85 g at 406 kcal per 100 g (USDA)',
	},
	{
		id: 'cat-soup-broth',
		text: 'курячий бульйон',
		expect: { decision: 'log_or_clarify', kcal: range(20, 130), categories: ['soup'] },
		reference: 'Borderline: broth → soup, not borscht; 250–400 ml at 6–30 kcal per 100 ml',
	},
	{
		id: 'cat-meat',
		text: 'свиняча відбивна',
		expect: { decision: 'log_or_clarify', categories: ['meat'] },
		reference: 'food-categories.md: meat',
	},
	{
		id: 'cat-sausage',
		text: '2 сосиски',
		expect: { decision: 'log', kcal: range(220, 400), categories: ['sausage'] },
		reference: '45–60 g each at 250–330 kcal per 100 g',
	},
	{
		id: 'cat-legumes',
		text: '100 г хумусу',
		expect: { decision: 'log', kcal: range(160, 300), categories: ['legumes'] },
		reference: 'USDA commercial hummus 166; homemade with tahini/oil up to ~300',
	},
	{
		id: 'cat-cheese',
		text: '2 скибочки твердого сиру',
		expect: { decision: 'log', kcal: range(90, 170), categories: ['cheese'] },
		reference: '15–25 g each at 350–400 kcal per 100 g',
	},
	{
		id: 'cat-cake',
		text: 'шматок торта Наполеон',
		expect: { decision: 'log_or_clarify', categories: ['cake'] },
		reference: 'food-categories.md: cake',
	},
	{
		id: 'cat-ice-cream',
		text: 'ріжок морозива пломбір',
		expect: { decision: 'log', kcal: range(180, 320), categories: ['ice_cream'] },
		reference: '70–100 g plombir ~230 kcal per 100 g + wafer cone',
	},
	{
		id: 'cat-protein-shake-milk',
		text: 'протеїновий коктейль на молоці',
		expect: { decision: 'log_or_clarify', categories: ['protein_shake'] },
		reference: 'Borderline: protein on milk → protein_shake, not milk',
	},
	{
		id: 'cat-salad-oil-separate',
		text: 'салат з огірків і помідорів, окремо 1 столова ложка оливкової олії',
		expect: { decision: 'log', kcal: range(140, 210), categories: ['salad', 'sauce'] },
		reference:
			'Borderline: oil as a separate item → sauce; 200–300 g veg ~40–60 kcal + 13 g oil ~115',
	},
	{
		id: 'cat-latte',
		text: 'лате 300 мл',
		expect: { decision: 'log', kcal: range(120, 200), categories: ['coffee'] },
		reference: 'Borderline: latte → coffee (food-categories.md); ~250 ml milk 2–3.2 %',
	},
]
