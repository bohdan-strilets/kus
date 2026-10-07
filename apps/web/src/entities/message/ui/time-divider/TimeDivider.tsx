import { Text } from '@/shared/ui'

/** The time between message groups (docs: 12 muted on white 60%, radius 10, centred). */
export const TimeDivider = ({ time }: { time: string }) => (
	<Text
		as="span"
		variant="small"
		weight="regular"
		tone="muted"
		className="self-center rounded-badge bg-white/60 px-2.5 py-0.5"
	>
		{time}
	</Text>
)
