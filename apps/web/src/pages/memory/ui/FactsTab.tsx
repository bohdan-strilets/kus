import type { FactResponse } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FactRow, factsQueryOptions, groupFacts } from '@/entities/fact'
import { EditFactSheet } from '@/features/edit-fact'
import { InlineError, RowGroup, Text } from '@/shared/ui'

import { FactsStorageNote } from './FactsStorageNote'
import { ListSkeleton } from './ListSkeleton'
import { MemoryEmpty } from './MemoryEmpty'

/** «Про тебе» (mockups/memory-facts.html): the facts in groups, the note about storage, the sheet of a fact. */
export const FactsTab = () => {
	const { t } = useTranslation()
	const query = useQuery(factsQueryOptions)
	const [selected, setSelected] = useState<FactResponse | null>(null)
	const facts = query.data
	const groups = useMemo(() => groupFacts(facts ?? []), [facts])

	const renderList = (): ReactNode => {
		if (query.isPending) return <ListSkeleton hasIcon={false} />
		if (query.isError && !facts) {
			return (
				<InlineError message={t('memory.facts.loadError')} onRetry={() => void query.refetch()} />
			)
		}
		if (groups.length === 0) {
			return (
				<>
					<MemoryEmpty title={t('memory.facts.empty.title')} text={t('memory.facts.empty.text')} />
					<FactsStorageNote factsCount={0} />
				</>
			)
		}
		return (
			<>
				{groups.map((group) => (
					<section
						key={group.category}
						aria-label={t(`memory.facts.group.${group.category}`)}
						className="flex flex-col gap-1.5"
					>
						<Text as="p" variant="eyebrow" tone="muted" className="px-1">
							{t(`memory.facts.group.${group.category}`)}
						</Text>
						<RowGroup>
							{group.facts.map((fact) => (
								<FactRow key={fact.id} fact={fact} onSelect={setSelected} />
							))}
						</RowGroup>
					</section>
				))}
				<FactsStorageNote factsCount={facts?.length ?? 0} />
			</>
		)
	}

	return (
		<>
			{renderList()}
			{/* always mounted: «Скасувати» in the toast of a delete outlives the list that held the row */}
			<EditFactSheet
				fact={selected}
				onClose={() => {
					setSelected(null)
				}}
			/>
		</>
	)
}
