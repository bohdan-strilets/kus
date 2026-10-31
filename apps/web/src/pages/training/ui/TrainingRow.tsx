import { Link } from 'react-router'

import { GroupTag } from '@/entities/workout'
import { Icon, ICON_SIZE, Text } from '@/shared/ui'

import type { JournalRow } from '../lib/get-journal-row'

const TROPHY_ICON_SIZE = 13

interface TrainingRowProps {
	row: JournalRow
	/** The date column shows on the first training of a day only. */
	isDateShown: boolean
}

/** One training of the journal (mockups/training-home.html): the date, place · time, groups, records. */
export const TrainingRow = ({ row, isDateShown }: TrainingRowProps) => (
	<Link
		to={row.href}
		aria-label={row.ariaLabel}
		className="flex min-h-16 items-center gap-3 py-2 text-ink"
	>
		<span aria-hidden="true" className="flex w-11 flex-none flex-col items-center">
			{isDateShown && (
				<>
					<Text as="span" variant="small" weight="regular" tone="muted">
						{row.weekday}
					</Text>
					<span className="text-title leading-tight tabular-nums">{row.day}</span>
				</>
			)}
		</span>
		<span aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1.25">
			<Text as="span" variant="body" weight="bold">
				{row.title}
			</Text>
			{row.groups.length > 0 && (
				<span className="flex flex-wrap items-center gap-1.25">
					{row.groups.map((group) => (
						<GroupTag key={group} group={group} size="sm" />
					))}
					{row.hiddenGroupCount > 0 && (
						<Text as="span" variant="small" weight="bold" tone="mutedStrong">
							{`+${row.hiddenGroupCount}`}
						</Text>
					)}
				</span>
			)}
		</span>
		{row.recordCount > 0 && (
			<span
				aria-hidden="true"
				className="inline-flex flex-none items-center gap-0.75 rounded-tag bg-success-soft px-2 py-0.5 text-small font-bold text-success-ink"
			>
				<Icon name="trophy" size={TROPHY_ICON_SIZE} />
				{row.recordCount}
			</span>
		)}
		<Icon name="chevron-right" size={ICON_SIZE.control} className="flex-none text-muted-strong" />
	</Link>
)
