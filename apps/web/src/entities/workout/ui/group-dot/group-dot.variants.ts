import type { TrainingGroupKey } from '@kus/shared'
import { cva, type VariantProps } from 'class-variance-authority'

// OTHER is the neutral dot for an exercise without a group (GroupDot maps null to it)
type GroupDotKey = TrainingGroupKey | 'OTHER'

const GROUP_CLASSES: Readonly<Record<GroupDotKey, string>> = {
	CARDIO: 'bg-muscle-cardio-ink',
	CHEST: 'bg-muscle-chest-ink',
	BACK: 'bg-muscle-back-ink',
	LEGS: 'bg-muscle-legs-ink',
	SHOULDERS: 'bg-muscle-shoulders-ink',
	ARMS: 'bg-muscle-arms-ink',
	CORE: 'bg-muscle-core-ink',
	OTHER: 'bg-muted-soft',
}

/** A dot in the ink colour of the group, 7–10 px (training-groups). */
export const groupDotVariants = cva('inline-block flex-none rounded-full', {
	variants: {
		group: GROUP_CLASSES,
		size: {
			sm: 'size-1.75',
			md: 'size-2.5',
		},
	},
	defaultVariants: { size: 'md' },
})

export type GroupDotVariantProps = VariantProps<typeof groupDotVariants>
