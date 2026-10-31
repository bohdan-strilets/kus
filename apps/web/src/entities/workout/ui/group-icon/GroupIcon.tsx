import type { TrainingGroupKey } from '@kus/shared'

import { Icon, type IconName } from '@/shared/ui'

import { groupIconVariants } from './group-icon.variants'

const GROUP_ICON_SIZE = 20

export interface GroupIconProps {
	icon: IconName
	/** null: the group of a strength exercise is unknown. */
	group: TrainingGroupKey | null
}

/** The icon of an exercise on the tint of its muscle group; decorative, the name sits beside it. */
export const GroupIcon = ({ icon, group }: GroupIconProps) => (
	<span aria-hidden="true" className={groupIconVariants({ group: group ?? 'OTHER' })}>
		<Icon name={icon} size={GROUP_ICON_SIZE} />
	</span>
)
