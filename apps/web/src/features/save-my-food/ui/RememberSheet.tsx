import type { FoodEntryResponse } from '@kus/shared'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatEntryAmount } from '@/entities/entry'
import { BaseBottomSheet, Button, Checkbox, FoodIcon, Text } from '@/shared/ui'

import { getInitialSelection, getSelectedIds } from '../lib/get-rememberable-entries'

interface RememberSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	/** The new lines of the card: the ones already in memory are not offered. */
	entries: readonly FoodEntryResponse[]
	isPending: boolean
	onSubmit: (entryIds: readonly string[]) => void
}

/** docs Sheet «Що запам'ятати?» (mockups/chat-remember-product.html): a checkbox per new line. */
export const RememberSheet = ({
	isOpen,
	onOpenChange,
	entries,
	isPending,
	onSubmit,
}: RememberSheetProps) => {
	const { t } = useTranslation()
	const idPrefix = useId()
	const [selection, setSelection] = useState<ReadonlySet<string>>(() =>
		getInitialSelection(entries),
	)
	const selectedIds = getSelectedIds(entries, selection)

	const toggle = (entryId: string, isChecked: boolean): void => {
		setSelection((current) => {
			const next = new Set(current)
			if (isChecked) next.add(entryId)
			else next.delete(entryId)
			return next
		})
	}

	return (
		<BaseBottomSheet isOpen={isOpen} onOpenChange={onOpenChange} title={t('remember.sheetTitle')}>
			<div className="flex flex-col gap-0.5">
				{entries.map((entry) => {
					const id = `${idPrefix}-${entry.id}`
					return (
						<label
							key={entry.id}
							htmlFor={id}
							className="flex min-h-tap cursor-pointer items-center gap-3 px-1.5 py-1"
						>
							<Checkbox
								id={id}
								isChecked={selection.has(entry.id)}
								onCheckedChange={(isChecked) => {
									toggle(entry.id, isChecked)
								}}
							/>
							<FoodIcon category={entry.category} />
							<span className="flex min-w-0 flex-1 flex-col">
								<Text as="span" variant="cardTitle" weight="semibold">
									{entry.name}
								</Text>
								<Text as="span" variant="small" weight="regular" tone="muted">
									{formatEntryAmount(entry, t)}
								</Text>
							</span>
						</label>
					)
				})}
			</div>
			<Button
				isFullWidth
				isLoading={isPending}
				loadingText={t('remember.saving')}
				disabled={selectedIds.length === 0}
				onClick={() => {
					onSubmit(selectedIds)
				}}
			>
				{t('remember.action')}
			</Button>
		</BaseBottomSheet>
	)
}
