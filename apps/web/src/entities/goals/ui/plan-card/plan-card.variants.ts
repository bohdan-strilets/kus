import { cva } from 'class-variance-authority'
import type { ParseKeys } from 'i18next'

export const planMacroTileVariants = cva(
	'flex flex-col items-center gap-px rounded-tile-sm px-1.5 py-2',
	{
		variants: {
			macro: {
				protein: 'bg-protein-bg',
				carbs: 'bg-carbs-bg',
				fat: 'bg-fat-bg',
			},
		},
	},
)

interface PlanCardMacro {
	macro: 'protein' | 'carbs' | 'fat'
	labelKey: ParseKeys
	inkClass: string
}

// protein, carbs, fat: the order of the macros everywhere
export const PLAN_CARD_MACROS: PlanCardMacro[] = [
	{ macro: 'protein', labelKey: 'macro.protein', inkClass: 'text-protein-ink' },
	{ macro: 'carbs', labelKey: 'macro.carbs', inkClass: 'text-carbs-ink' },
	{ macro: 'fat', labelKey: 'macro.fat', inkClass: 'text-fat-ink' },
]
