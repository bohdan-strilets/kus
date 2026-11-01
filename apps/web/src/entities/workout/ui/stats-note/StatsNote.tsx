import { Surface, Text } from '@/shared/ui'

/** One sentence in a card, where a chart or a list would have been: nothing to draw yet. */
export const StatsNote = ({ text }: { text: string }) => (
	<Surface variant="list" radius="bubbleAi" className="p-4">
		<Text tone="mutedStrong" className="text-center">
			{text}
		</Text>
	</Surface>
)
