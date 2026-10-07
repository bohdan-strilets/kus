import { cva, type VariantProps } from 'class-variance-authority'

/** Type scale from tokens.json font.scale (+ title/input added in tokens.css). */
export const textVariants = cva('', {
	variants: {
		variant: {
			body: 'text-body font-medium',
			cardTitle: 'text-card-title',
			caption: 'text-caption',
			small: 'text-small',
			/** 12/700 uppercase section labels */
			eyebrow: 'text-small font-bold tracking-wider uppercase',
			bigNumber: 'text-big-number tabular-nums',
			/** 28/800 — the number inside the large calorie ring */
			gauge: 'text-gauge tabular-nums',
			/** 17/800 — «з'їдено» / «ціль» next to the large ring */
			stat: 'text-stat tabular-nums',
		},
		tone: {
			ink: 'text-ink',
			muted: 'text-muted',
			mutedStrong: 'text-muted-strong',
			primary: 'text-primary',
			/** small text on primary-soft / primary-selected and links on bg-app (contrast) */
			primaryDeep: 'text-primary-deep',
			success: 'text-success',
			successInk: 'text-success-ink',
			/** over-goal numbers and captions (contrast: `over` is for arcs only) */
			overInk: 'text-over-ink',
			/** only large text (≥ 24px): `over` is 4.40:1 on white */
			over: 'text-over',
			danger: 'text-danger',
			onDark: 'text-white',
		},
		weight: {
			default: '',
			/** 400 — the mockups' plain captions («3 шт · 150 г», «з 2 200 ккал») */
			regular: 'font-normal',
			medium: 'font-medium',
			semibold: 'font-semibold',
			bold: 'font-bold',
			extrabold: 'font-extrabold',
		},
	},
	defaultVariants: { variant: 'body', tone: 'ink', weight: 'default' },
})

export type TextVariantProps = VariantProps<typeof textVariants>
