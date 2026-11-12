// Named composition (0.11.6): «канапка з …» / «бутерброд: …» is logged as its parts, never as one
// «Канапка» item next to them. Written before the prompt sentence: red or unknown until it lands.
import { range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

/** The dish's own name is not an item; the parts the user listed are. */
const PARTS_ONLY = { minItems: 2, maxItems: 3 } as const

export const DISH_PARTS_CASES: EvalCase[] = [
	{
		id: 'dish-parts-canape',
		text: "я з'їв канапку з рисового коржика, індичої ковбаски й кетчупу",
		expect: {
			decision: 'log',
			...PARTS_ONLY,
			kcal: range(70, 260),
			itemNameExcludes: ['канапк'],
		},
		reference:
			'Rice cake 8–10 g ≈ 35 kcal, turkey sausage 20–40 g ≈ 30–70 kcal, ketchup 10–15 g ≈ 10–15 kcal: the listed parts, no «Канапка» item',
	},
	{
		id: 'dish-parts-colon',
		text: 'канапка: рисовий коржик, ковбаска, кетчуп',
		expect: {
			decision: 'log',
			...PARTS_ONLY,
			kcal: range(70, 260),
			itemNameExcludes: ['канапк'],
		},
		reference:
			'The same parts after a colon: the dish name is the heading, the parts are the items',
	},
	{
		id: 'dish-parts-sandwich-weights',
		text: 'бутерброд: хліб 40 г, масло 10 г, сир 30 г',
		expect: {
			decision: 'log',
			...PARTS_ONLY,
			kcal: range(230, 330),
			itemNameExcludes: ['бутерброд'],
		},
		reference:
			'Bread 40 g ≈ 105 kcal, butter 10 g ≈ 72, cheese 30 g ≈ 100–120: three weighed parts, no «Бутерброд» item',
	},
	{
		id: 'dish-parts-borscht-sour-cream',
		text: 'борщ і дві ложки сметани',
		expect: { decision: 'log', maxItems: 2 },
		reference:
			'Control: borscht and sour cream are two foods the user named, not a composed dish; at most two items',
	},
]
