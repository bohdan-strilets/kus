import { useTranslation } from 'react-i18next'

import { Icon, ICON_SIZE, Surface, Text } from '@/shared/ui'

/** Facts below this many: the note starts open (mockups/memory-facts.html), later it is folded. */
export const STORAGE_NOTE_OPEN_BELOW = 3

interface FactsStorageNoteProps {
	factsCount: number
}

/** «Що зберігається і як видалити»: a native disclosure, open by default while there are few facts. */
export const FactsStorageNote = ({ factsCount }: FactsStorageNoteProps) => {
	const { t } = useTranslation()

	return (
		<Surface variant="soft" radius="card" shadow="none" className="mt-1">
			<details open={factsCount < STORAGE_NOTE_OPEN_BELOW} className="group">
				<summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 px-4 [&::-webkit-details-marker]:hidden">
					<Icon
						name="chevron-down"
						size={ICON_SIZE.small}
						className="shrink-0 -rotate-90 text-muted transition-transform group-open:rotate-0"
					/>
					<Text as="span" variant="cardTitle" weight="bold">
						{t('memory.facts.storage.title')}
					</Text>
				</summary>
				<div className="flex flex-col gap-2 px-4 pb-4">
					<Text variant="caption" tone="mutedStrong">
						{t('memory.facts.storage.textKept')}
					</Text>
					<Text variant="caption" tone="mutedStrong">
						{t('memory.facts.storage.textDelete')}
					</Text>
				</div>
			</details>
		</Surface>
	)
}
