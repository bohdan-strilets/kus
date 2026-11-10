// Honest soup (0.11.1): a pot of soup is weighed raw, the water decides the kcal per 100 g, and the
// recipe is shown only from what the user actually wrote. Fixtures are made up. Clock: Wed 2026-10-07.
import { entry, NO_MEMORY_CALLS, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'
import { savedFood } from '../read-fixtures.js'

const SOUP_SAVED = savedFood({
	name: 'Суп курячий з макаронами',
	per100g: { kcal: 25, protein: 2.5, fat: 0.7, carbs: 3 },
	defaultGrams: 400,
	category: 'soup',
	usageCount: 5,
})

const SOUP_TODAY = entry('e1', 'Суп курячий з макаронами', 'LUNCH', 850, 195, 'soup')

/** The recipe shown from nothing: no invented volume, no invented list. */
const NO_INVENTED_RECIPE = ['у твоєму записі', '2 л', 'інгредієнти:', '### інгредієнти', '600 г']

export const SOUP_CASES: EvalCase[] = [
	{
		id: 'soup-pot-incident',
		text: 'Готую суп\n400г кур філе\n250г картоплі\n200г моркви\n50г макаронів\nВсе це в сухому вигляді\nСпеції\nІ все без засмажки\nДодай порцію 750г',
		expect: {
			decision: 'clarify',
			kcal: range(120, 400),
			categories: ['soup'],
			clarifyAbout: ['суп'],
			replyIncludesAny: ['вод'],
		},
		reference:
			'The pot weight and the dry products are known, the water is not: 750 g of soup is 16–53 kcal/100 g depending on the water. Logged as the best estimate (120–400 kcal), and the model asks how much water went in',
	},
	{
		id: 'soup-pot-with-water',
		text: "Зварив суп: 600 г сирого філе, 150 г сухих макаронів, 100 г моркви, 100 г цибулі, 5 л води. З'їв 850 г",
		expect: { decision: 'log', kcal: range(160, 240), categories: ['soup'] },
		reference:
			'The pot holds about 1260 kcal (600 g raw fillet ≈ 650, 150 g dry pasta ≈ 530, vegetables ≈ 80) in roughly 5.9 kg with the water: ≈ 21 kcal/100 g × 850 g ≈ 180 kcal. The water is named, so no question',
	},
	{
		id: 'soup-pot-weighed',
		text: "Зварив суп: 500 г філе, 200 г картоплі, 100 г моркви, вода 3 л. Каструля вийшла 3,2 кг, з'їв 400 г",
		expect: { decision: 'log', kcal: range(90, 200) },
		reference:
			'The finished pot weighs 3.2 kg and holds about 1000 kcal (fillet ≈ 550, potato ≈ 150, carrot ≈ 40, minus little): ≈ 31 kcal/100 g × 400 g ≈ 125 kcal. The weight of the pot is given, no question',
	},
	{
		id: 'soup-pot-plates',
		text: 'Зварила борщ на 3 літри: 500 г яловичини, 300 г капусти, 200 г буряка, 200 г картоплі, 100 г моркви. Вийшло 6 тарілок, з’їла одну тарілку',
		context: { addressForm: 'NEUTRAL' },
		expect: { decision: 'log', kcal: range(120, 300) },
		reference:
			'The pot is 3 litres in 6 plates: one plate is a sixth of the pot (≈ 500 g). Beef ≈ 700–1000 kcal and the vegetables ≈ 250 kcal give ≈ 150–210 kcal a plate',
	},
	{
		id: 'soup-noodle-plate',
		text: 'Тарілка курячого супу з вермішеллю',
		expect: { decision: 'log_or_clarify', kcal: range(80, 200), categories: ['soup'] },
		reference:
			'A plate of chicken noodle soup (≈ 300–400 g at 25–50 kcal/100 g): ≈ 80–200 kcal, a typical estimate',
	},
	{
		id: 'soup-again-memory',
		text: 'Ще тарілку того супу',
		savedFoods: [SOUP_SAVED],
		expect: {
			decision: 'log_or_clarify',
			memoryRefs: ['m1'],
			kcal: range(70, 130),
			findFoodCalled: false,
		},
		reference:
			'The saved soup (25 kcal/100 g, plate 400 g by default) is named in the passive block as m1: 100 kcal, taken from the memory with no lookup',
	},
	{
		id: 'recipe-show-none',
		text: 'Покажи рецепт сьогоднішнього супу',
		context: { entries: [SOUP_TODAY] },
		expect: {
			decision: 'reply',
			replyIncludesAny: ['не збер', 'немає', 'не запис', 'не бачу'],
			replyExcludes: NO_INVENTED_RECIPE,
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'Today the soup e1 is logged as 850 g / 195 kcal without a recipe and no message in the history lists the products: the reply says there is no saved recipe and invents none',
	},
	{
		id: 'recipe-show-from-history',
		text: 'Покажи рецепт сьогоднішнього супу',
		context: {
			entries: [SOUP_TODAY],
			history: [
				{
					role: 'user',
					content:
						'Готую суп\n410г кур філе\n250г картоплі\n200г моркви\n50г макаронів\nДодай порцію 750г',
					loggedRefs: ['e1'],
				},
				{ role: 'assistant', content: 'Записав суп, 750 г.' },
			],
		},
		expect: {
			decision: 'reply',
			replyIncludes: ['410'],
			replyExcludes: ['2 л', 'у твоєму записі'],
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'The products of the soup are in the earlier message (410 g fillet, 250 g potato, 200 g carrot, 50 g pasta): the recipe is shown from them, with no made-up water volume and no claim that it is in the entry',
	},
]
