import { cva, type VariantProps } from 'class-variance-authority'

/** mockups/photo-history.html: 248 wide, radius 16, the height is set by the caller. */
export const photoTileVariants = cva('relative w-62 shrink-0 overflow-hidden rounded-tile', {
	variants: {
		tone: {
			/** a neutral base: the skeleton pulses and the picture fades in over it, not over the orange bubble */
			media: 'bg-field',
			/** «Не вдалося завантажити» */
			error: 'flex flex-col items-center justify-center gap-1.5 bg-field text-center',
			/** «Фото не збереглося»: not an error, a dashed outline */
			missing:
				'flex flex-col items-center justify-center gap-1.5 border border-dashed border-line-strong bg-field text-center',
		},
	},
	defaultVariants: { tone: 'media' },
})

export type PhotoTileVariantProps = VariantProps<typeof photoTileVariants>
