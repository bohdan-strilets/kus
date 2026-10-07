// The user's words beat a saved food: "лише рідина", "без олії" change the food itself, so the
// saved values must not be used as is. Using them unchanged lands outside the range.
import type { MemoryFoodContext } from '@kus/shared'

import { range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

const CHICKEN_SOUP: MemoryFoodContext = {
	ref: 'm1',
	name: 'Суп курячий з локшиною і картоплею',
	aliases: ['курячий суп', 'суп'],
	per100g: { kcal: 55, protein: 3.5, fat: 2, carbs: 6 },
	pieceGrams: null,
	defaultGrams: 350,
	category: 'soup',
}

const BUCKWHEAT_WITH_OIL: MemoryFoodContext = {
	ref: 'm1',
	name: 'Гречка з олією',
	aliases: ['гречка'],
	per100g: { kcal: 150, protein: 4, fat: 5.5, carbs: 21 },
	pieceGrams: null,
	defaultGrams: 200,
	category: 'porridge',
}

export const MEMORY_OVERRIDE_CASES: EvalCase[] = [
	{
		id: 'memory-liquid-only',
		text: '350 г курячого супу, але лише рідкий бульйон, без гущі',
		context: { memory: [CHICKEN_SOUP] },
		expect: { decision: 'log_or_clarify', kcal: range(20, 110), categories: ['soup'] },
		reference:
			'Broth only: 6–30 kcal per 100 g × 350 g; the saved soup with noodles and potatoes would give 193',
	},
	{
		id: 'memory-without-oil',
		text: '200 г гречки, як завжди, але цього разу без олії',
		context: { memory: [BUCKWHEAT_WITH_OIL] },
		expect: { decision: 'log', kcal: range(184, 264), categories: ['porridge'] },
		reference:
			'Plain cooked buckwheat 92–132 kcal per 100 g (USDA / UA tables); the saved one with oil would give 300',
	},
]
