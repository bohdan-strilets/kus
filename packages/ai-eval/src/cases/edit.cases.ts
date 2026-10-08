// Fixing what is logged (stage 3C): the model changes entries by the refs of the day context —
// a portion, a name, delete / restore, an answer in words to an open question — and never logs
// a duplicate. Built after a live test: «зміни порцію на 600 г» logged a second borshch.
import type { FoodParseContext } from '@kus/shared'

import { entry, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

const BANANA = entry('e1', 'Банан', 'BREAKFAST', 120, 107, 'banana', {
	protein: 1.3,
	fat: 0.4,
	carbs: 27,
})
const BUCKWHEAT = entry('e2', 'Гречка варена', 'LUNCH', 200, 220, 'porridge', {
	protein: 8,
	fat: 2,
	carbs: 43,
})
const BORSCHT = entry('e3', 'Борщ червоний український', 'LUNCH', 350, 175, 'borscht', {
	protein: 7,
	fat: 8,
	carbs: 19,
})
const PORK = entry('e4', 'Свинина', 'DINNER', 300, 600, 'meat', { protein: 57, fat: 42, carbs: 0 })
const POTATOES = entry('e5', 'Картопля варена', 'DINNER', 200, 172, 'potatoes', {
	protein: 4,
	fat: 0.4,
	carbs: 38,
})

const porkOption = (label: string, kcal: number, protein: number, fat: number) => ({
	label,
	kcal,
	protein,
	fat,
	carbs: 0,
	fiber: 0,
	grams: 300,
	name: null,
})

/** A day with an open question about the pork: «Пісна 450 · Середня 600 · Жирна 800». */
const DAY: Partial<FoodParseContext> = {
	dayTotals: { kcal: 1274, protein: 77, fat: 53, carbs: 127 },
	meals: [
		{ type: 'BREAKFAST', kcal: 107 },
		{ type: 'LUNCH', kcal: 395 },
		{ type: 'DINNER', kcal: 772 },
	],
	entries: [BANANA, BUCKWHEAT, BORSCHT, PORK, POTATOES],
	openClarifications: [
		{
			ref: 'c1',
			question: 'Яка була свинина?',
			entryRefs: ['e4'],
			options: [
				porkOption('Пісна (вирізка)', 450, 66, 20),
				porkOption('Середня', 600, 57, 42),
				porkOption('Жирна (шия, реберця)', 800, 48, 68),
			],
		},
	],
	history: [
		{ role: 'user', content: '300г свинини 200 г вареної картошки' },
		{ role: 'assistant', content: 'Записав. Смачного!' },
	],
}

/** The live bug: two borshches logged, the second one by «зміни порцію». */
const DAY_WITH_DUPLICATE: Partial<FoodParseContext> = {
	dayTotals: { kcal: 772, protein: 25, fat: 20, carbs: 122 },
	meals: [{ type: 'SNACK', kcal: 772 }],
	entries: [
		{ ...BANANA, mealType: 'SNACK' },
		{ ...BUCKWHEAT, mealType: 'SNACK' },
		{ ...BORSCHT, mealType: 'SNACK' },
		entry('e4', 'Борщ червоний український', 'SNACK', 600, 270, 'borscht', {
			protein: 9,
			fat: 10,
			carbs: 33,
		}),
	],
}

const SOUP = entry('e1', 'Суп', 'LUNCH', 300, 150, 'soup', { protein: 6, fat: 6, carbs: 18 })

const DAY_WITH_SOUP_QUESTION: Partial<FoodParseContext> = {
	dayTotals: { kcal: 150, protein: 6, fat: 6, carbs: 18 },
	meals: [{ type: 'LUNCH', kcal: 150 }],
	entries: [SOUP],
	openClarifications: [
		{
			ref: 'c1',
			question: 'Який суп і яка тарілка?',
			entryRefs: ['e1'],
			options: [
				{
					label: 'Овочевий',
					kcal: 150,
					protein: 6,
					fat: 6,
					carbs: 18,
					fiber: null,
					grams: null,
					name: null,
				},
				{
					label: 'Харчо',
					kcal: 330,
					protein: 18,
					fat: 18,
					carbs: 24,
					fiber: null,
					grams: null,
					name: null,
				},
			],
		},
	],
}

/** Stems of a reply that claims a change; a reply about yesterday must not. */
const CHANGE_CLAIMS = ['змінив', 'замінив', 'виправив', 'оновив', 'видалив']

export const EDIT_CASES: EvalCase[] = [
	{
		id: 'edit-portion-grams',
		text: 'зміни порцію борщу на 600 г',
		context: DAY,
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e3', grams: range(600, 600), kcal: range(290, 310) }] },
		},
		reference: 'Grams only: the backend rescales 175 kcal / 350 g → 300 kcal; no second borshch',
	},
	{
		id: 'edit-portion-from-history',
		text: 'зміни порцію на 600 г',
		context: {
			...DAY,
			history: [
				{ role: 'user', content: 'тарілка червоного укр борщу' },
				{ role: 'assistant', content: 'Записав тарілку борщу, порцію оцінив на 350 г.' },
			],
		},
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e3', grams: range(600, 600), kcal: range(290, 310) }] },
		},
		reference: 'The live case: the portion is the borshch of the last turn',
	},
	{
		id: 'edit-portion-buckwheat',
		text: 'гречки було 250 г, а не 200',
		context: DAY,
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e2', grams: range(250, 250), kcal: range(270, 280) }] },
		},
		reference: '220 kcal / 200 g × 250 g = 275',
	},
	{
		id: 'edit-rename',
		text: 'це був не борщ, а курячий суп з локшиною',
		context: DAY,
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e3', nameIncludes: 'суп', kcal: range(100, 260) }] },
		},
		reference: 'The food itself changes: new name and values for 350 g of chicken noodle soup',
	},
	{
		id: 'edit-delete',
		text: 'видали банан',
		context: DAY,
		expect: { decision: 'edit', edits: { deleted: ['e1'] } },
		reference: 'delete_entry by ref',
	},
	{
		id: 'edit-delete-duplicate',
		text: 'видали другий борщ',
		context: DAY_WITH_DUPLICATE,
		expect: { decision: 'edit', edits: { deleted: ['e4'] } },
		reference: '«другий» = the later of two borshches (the live duplicate)',
	},
	{
		id: 'edit-restore',
		text: 'ой, поверни',
		context: {
			...DAY,
			deletedEntries: [{ ref: 'e6', name: 'Хліб житній', grams: 60, kcal: 150 }],
			history: [
				{ role: 'user', content: 'видали хліб' },
				{ role: 'assistant', content: 'Прибрав хліб.' },
			],
		},
		expect: { decision: 'edit', edits: { restored: ['e6'] } },
		reference: 'restore_entry with the ref from «Deleted today»',
	},
	{
		id: 'resolve-words-between',
		text: 'свинина була трішки жирна',
		context: DAY,
		expect: {
			decision: 'edit',
			edits: { resolved: [{ ref: 'c1', kinds: ['values', 'option'], kcal: range(620, 800) }] },
		},
		reference:
			'The live case: between «Середня» 600 and «Жирна» 800 (or the fatter option), the same entry — no «extra fat» item',
	},
	{
		id: 'resolve-words-option',
		text: 'свинина була пісна, вирізка',
		context: DAY,
		expect: {
			decision: 'edit',
			edits: { resolved: [{ ref: 'c1', kinds: ['option'], optionIndex: 0 }] },
		},
		reference: 'Matches option 0 «Пісна (вирізка)»',
	},
	{
		id: 'resolve-outside-options',
		text: 'це був просто бульйон, без нічого',
		context: DAY_WITH_SOUP_QUESTION,
		expect: {
			decision: 'edit',
			edits: {
				resolved: [{ ref: 'c1', kinds: ['close'] }],
				corrected: [{ ref: 'e1', kcal: range(15, 120) }],
			},
		},
		reference:
			'Below both options (150 / 330): close the question without values and correct the soup to a broth (~30–60 kcal)',
	},
	{
		id: 'edit-yesterday',
		text: 'вчора ввечері був не борщ, а суп',
		context: DAY,
		expect: { decision: 'reply', replyExcludes: CHANGE_CLAIMS },
		reference: 'Only today can be changed: say so honestly, change nothing',
	},
	{
		id: 'edit-plus-log',
		text: "ще з'їв яблуко, а банан видали",
		context: DAY,
		expect: {
			decision: 'log',
			categories: ['fruit'],
			kcal: range(70, 110),
			edits: { deleted: ['e1'] },
		},
		reference: 'New food (apple ~180 g ≈ 94 kcal) and a delete in one message',
	},
	{
		id: 'clarify-chicken-raw-cooked',
		text: '150 г курячого філе',
		expect: { decision: 'clarify', kcal: range(160, 260), categories: ['poultry'] },
		reference: 'Logged as cooked (~248 kcal), raw ~165 — 83 kcal and 33 % → clarify',
	},
	{
		id: 'clarify-pasta-rename',
		text: '200 г макаронів',
		expect: {
			decision: 'clarify',
			kcal: range(250, 340),
			categories: ['pasta'],
			clarifyRenames: true,
		},
		reference: 'Cooked ~316 vs dry ~740 kcal; the «сухі» option renames the item',
	},
]
