import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Text } from '@/shared/ui'

import {
	formatProgramChangeLine,
	type ProgramChangeGroup,
	type ProgramChangeKind,
} from '../lib/format-program-changes'

const MARK_BY_KIND: Record<ProgramChangeKind, string> = { added: '+', removed: '−', changed: '→' }

const ROW_CLASS_BY_KIND: Record<ProgramChangeKind, string> = {
	removed: 'bg-danger-soft text-danger',
	added: 'bg-success-soft text-success-ink',
	changed: 'bg-muscle-arms-bg text-muscle-arms-ink',
}

interface ProgramChangeListProps {
	groups: ProgramChangeGroup[]
	/** One flat list, one line per change led by its template («Б: Махи — 4 підходи · 12–15 повт.»), as in the sheet «Що змінилось». */
	isPrefixed?: boolean
}

interface ChangeSection {
	key: string
	label: string | null
	rows: ProgramChangeGroup['rows']
}

const toSections = (groups: ProgramChangeGroup[], isPrefixed: boolean): ChangeSection[] =>
	isPrefixed
		? [
				{
					key: 'all',
					label: null,
					rows: groups.flatMap((group) =>
						group.rows.map((row) => ({
							...row,
							title: formatProgramChangeLine(row, group.label),
							detail: null,
						})),
					),
				},
			]
		: groups

/**
 * The lines of a change by template: «−» removed (struck out), «+» added, «→» changed with «було … ·
 * стало …». The colour is never the only carrier: the mark and a hidden word say it too.
 */
export const ProgramChangeList = ({ groups, isPrefixed = false }: ProgramChangeListProps) => {
	const { t } = useTranslation()
	return (
		<div className="flex flex-col gap-2.5">
			{toSections(groups, isPrefixed).map((group) => (
				<section key={group.key} className="flex flex-col gap-1.5">
					{group.label !== null && (
						<Text as="p" role="heading" aria-level={4} variant="eyebrow" tone="muted">
							{group.label}
						</Text>
					)}
					<ul className="flex flex-col gap-1.5">
						{group.rows.map((row) => (
							<li
								key={row.key}
								className={cn(
									'flex items-start gap-2 rounded-icon px-3 py-2',
									ROW_CLASS_BY_KIND[row.kind],
								)}
							>
								<span aria-hidden="true" className="w-3 flex-none text-card-title font-bold">
									{MARK_BY_KIND[row.kind]}
								</span>
								<span className="flex min-w-0 flex-col">
									<span className="sr-only">{t(`program.diff.sr.${row.kind}`)}</span>
									<span
										className={cn(
											'text-card-title font-bold',
											row.kind === 'removed' && 'line-through',
										)}
									>
										{row.title}
									</span>
									{row.detail !== null && (
										<span className="text-small font-normal">{row.detail}</span>
									)}
								</span>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	)
}
