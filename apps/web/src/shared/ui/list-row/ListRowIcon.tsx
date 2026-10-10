import { Icon, type IconName } from '../icon'
import { ROW_ICON_SIZE } from './list-row.constants'
import { type ListRowIconVariantProps, listRowIconVariants } from './list-row.variants'

export type ListRowIconProps = ListRowIconVariantProps & {
	icon: IconName
}

export const ListRowIcon = ({ icon, tone }: ListRowIconProps) => (
	<span className={listRowIconVariants({ tone })}>
		<Icon name={icon} size={ROW_ICON_SIZE} />
	</span>
)
