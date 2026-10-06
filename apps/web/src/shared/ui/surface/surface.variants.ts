import { cva, type VariantProps } from 'class-variance-authority'

/** Card surfaces from the mockups: solid white, glass over the gradient, frosted lists, dashed tips. */
export const surfaceVariants = cva('', {
	variants: {
		variant: {
			solid: 'bg-surface',
			glass: 'bg-surface-glass',
			/** list rows, chips, back button (white 85% in today/chat mockups) */
			frosted: 'bg-surface/85',
			/** «Вечеря» suggestion row in today */
			dashed: 'border-2 border-dashed border-line-strong bg-surface/45',
			soft: 'bg-soft-card',
			field: 'bg-field',
			selected: 'bg-primary-selected',
		},
		radius: {
			none: '',
			sheet: 'rounded-sheet',
			card: 'rounded-card',
			panel: 'rounded-panel',
			bubbleAi: 'rounded-bubble-ai',
			bubble: 'rounded-bubble',
			chip: 'rounded-chip',
			tile: 'rounded-tile',
			tileSm: 'rounded-tile-sm',
		},
		shadow: {
			none: '',
			card: 'shadow-card',
			chip: 'shadow-chip',
			float: 'shadow-float',
			field: 'shadow-field',
		},
	},
	defaultVariants: { variant: 'solid', radius: 'card', shadow: 'card' },
})

export type SurfaceVariantProps = VariantProps<typeof surfaceVariants>
