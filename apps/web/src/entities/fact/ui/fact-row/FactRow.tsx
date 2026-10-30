import type { FactResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { Icon, ICON_SIZE, Text } from '@/shared/ui'

import { formatFactSource } from '../../lib/format-fact-source'

interface FactRowProps {
	fact: FactResponse
	onSelect: (fact: FactResponse) => void
}

/** mockups/memory-facts.html: the sentence, «з чату, 12 жовтня» under it and the pencil; the whole row is the button. */
export const FactRow = ({ fact, onSelect }: FactRowProps) => {
	const { t } = useTranslation()

	return (
		<button
			type="button"
			aria-haspopup="dialog"
			aria-label={t('memory.facts.rowLabel', { text: fact.text })}
			onClick={() => {
				onSelect(fact)
			}}
			className="flex min-h-tap w-full items-center gap-3 px-3.5 py-2.5 text-left"
		>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<Text as="span" variant="body" weight="semibold">
					{fact.text}
				</Text>
				<Text as="span" variant="small" weight="regular" tone="muted">
					{formatFactSource(fact, t)}
				</Text>
			</span>
			<span className="flex size-11 shrink-0 items-center justify-center text-muted">
				<Icon name="edit" size={ICON_SIZE.control} />
			</span>
		</button>
	)
}
