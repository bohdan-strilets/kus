import { cva, type VariantProps } from 'class-variance-authority'

/**
 * compact — the chat header (centred, padding 8 6, radius 14); bar — «Сьогодні» (padding 10,
 * radius 16, with a progress bar). Colours are always the macro's own: bg + ink, never alone.
 */
export const macroTileVariants = cva('flex flex-col', {
	variants: {
		macro: {
			protein: 'bg-protein-bg',
			carbs: 'bg-carbs-bg',
			fat: 'bg-fat-bg',
		},
		variant: {
			compact: 'items-center gap-0.5 rounded-tile-sm px-1.5 py-2',
			bar: 'gap-1.5 rounded-tile p-2.5',
		},
	},
	defaultVariants: { variant: 'bar' },
})

export const MACRO_INK_CLASS = {
	protein: 'text-protein-ink',
	carbs: 'text-carbs-ink',
	fat: 'text-fat-ink',
} as const

export type MacroTileVariantProps = VariantProps<typeof macroTileVariants>
