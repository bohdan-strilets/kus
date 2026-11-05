import type { TrainingGroupKey } from '@kus/shared'
import { cva, type VariantProps } from 'class-variance-authority'

// OTHER is the neutral dot for an exercise without a group (GroupDot maps null to it)
type GroupDotKey = TrainingGroupKey | 'OTHER'

const INK_CLASSES: Readonly<Record<GroupDotKey, string>> = {
	CARDIO: 'bg-muscle-cardio-ink',
	CHEST: 'bg-muscle-chest-ink',
	BACK: 'bg-muscle-back-ink',
	LEGS: 'bg-muscle-legs-ink',
	SHOULDERS: 'bg-muscle-shoulders-ink',
	ARMS: 'bg-muscle-arms-ink',
	CORE: 'bg-muscle-core-ink',
	OTHER: 'bg-muted-soft',
}

/** The light colour of the group, for a dot on the dark ink pill of the week strip. */
const ON_DARK_CLASSES: Readonly<Record<GroupDotKey, string>> = {
	CARDIO: 'bg-muscle-cardio-bg',
	CHEST: 'bg-muscle-chest-bg',
	BACK: 'bg-muscle-back-bg',
	LEGS: 'bg-muscle-legs-bg',
	SHOULDERS: 'bg-muscle-shoulders-bg',
	ARMS: 'bg-muscle-arms-bg',
	CORE: 'bg-muscle-core-bg',
	OTHER: 'bg-white/60',
}

const GROUP_KEYS = Object.keys(INK_CLASSES) as GroupDotKey[]

/** A dot in the ink colour of the group (on dark: its light colour), 5–10 px (training-groups). */
export const groupDotVariants = cva('inline-block flex-none rounded-full', {
	variants: {
		group: Object.fromEntries(GROUP_KEYS.map((key) => [key, ''])) as Record<GroupDotKey, string>,
		tone: {
			ink: '',
			onDark: '',
		},
		size: {
			/** the week strip: three of them fit under a number */
			xs: 'size-1.25',
			sm: 'size-1.75',
			md: 'size-2.5',
		},
	},
	compoundVariants: GROUP_KEYS.flatMap((group) => [
		{ group, tone: 'ink' as const, className: INK_CLASSES[group] },
		{ group, tone: 'onDark' as const, className: ON_DARK_CLASSES[group] },
	]),
	defaultVariants: { size: 'md', tone: 'ink' },
})

export type GroupDotVariantProps = VariantProps<typeof groupDotVariants>

/** The ink colour of the group as a background class (null is «Інше»), for bars. */
export const getGroupInkClass = (group: TrainingGroupKey | null): string =>
	INK_CLASSES[group ?? 'OTHER']
