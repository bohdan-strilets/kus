import { cva, type VariantProps } from 'class-variance-authority'

export const liveNetPillVariants = cva(
	'inline-flex min-h-8 items-center gap-2 rounded-tile px-3 text-caption',
	{
		variants: {
			phase: {
				offline: 'bg-surface/72 text-muted-strong',
				syncing: 'bg-surface/72 text-muted-strong',
				saved: 'bg-success-soft text-success-ink',
			},
		},
	},
)

// mockups/training-offline.html: a 14px grey ring, light track, dark top; still under reduced motion
export const liveSyncRingClass =
	'box-border size-3.5 flex-none rounded-full border-2 border-line border-t-muted-strong motion-safe:animate-spin'

export type LiveNetPillVariantProps = VariantProps<typeof liveNetPillVariants>
