import {
	type ExerciseKind,
	matchMuscleGroup,
	type MuscleGroup,
	normalizeExerciseName,
	type ProgramLastSet,
	TRAINING_GROUP_ORDER,
	type TrainingGroupKey,
} from '@kus/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDebouncedValue } from '@/shared/lib'
import { BaseBottomSheet, DashedAction, InlineError, Skeleton, Text } from '@/shared/ui'

import { exerciseDictionaryQueryOptions } from '../../model/workout-query'
import { GroupChip } from '../group-chip'
import { ExerciseResultRow } from './ExerciseResultRow'
import { ExerciseSearchField } from './ExerciseSearchField'

/** What the person picked: an exercise of «Мої вправи» (with its id) or a new name (id null). */
export interface ExercisePick {
	name: string
	exerciseId: string | null
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
	lastSets: ProgramLastSet[] | null
}

interface ExercisePickerSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	onPick: (pick: ExercisePick) => void
}

const SEARCH_DEBOUNCE_MS = 250
const SKELETON_ROWS = 4
// «Кардіо» goes last in the chips, though it is first everywhere else (mockups/training-program.html)
const CHIP_GROUPS: readonly TrainingGroupKey[] = [
	...TRAINING_GROUP_ORDER.filter((group) => group !== 'CARDIO'),
	'CARDIO',
]

/**
 * «Вправа» (mockups/training-program.html): search and group chips over «Мої вправи» with the last
 * result of each, and a dashed «Нова вправа «…»» when the typed name is not among them.
 */
export const ExercisePickerSheet = ({ isOpen, onOpenChange, onPick }: ExercisePickerSheetProps) => {
	const { t } = useTranslation()
	const [text, setText] = useState('')
	const [group, setGroup] = useState<TrainingGroupKey | null>(null)
	const [wasOpen, setWasOpen] = useState(isOpen)
	// every opening starts from an empty search
	if (isOpen !== wasOpen) {
		setWasOpen(isOpen)
		if (isOpen) {
			setText('')
			setGroup(null)
		}
	}
	const name = text.trim()
	const debouncedName = useDebouncedValue(name, SEARCH_DEBOUNCE_MS)
	const dictionary = useQuery({
		...exerciseDictionaryQueryOptions({
			query: debouncedName === '' ? undefined : debouncedName,
			group: group ?? undefined,
		}),
		enabled: isOpen,
	})
	const items = dictionary.data
	const isNameKnown =
		items?.some((item) => normalizeExerciseName(item.name) === normalizeExerciseName(name)) ?? false

	const addNew = (): void => {
		onPick({
			name,
			exerciseId: null,
			kind: group === 'CARDIO' ? 'CARDIO' : 'STRENGTH',
			muscleGroup: group === null || group === 'CARDIO' ? matchMuscleGroup(name) : group,
			lastSets: null,
		})
	}

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('program.editor.addTitle')}
		>
			<ExerciseSearchField value={text} onChange={setText} />
			<div className="-mr-4 -ml-1 scrollbar-none flex shrink-0 gap-1.5 overflow-x-auto py-1 pr-4 pl-1">
				{CHIP_GROUPS.map((chipGroup) => (
					<GroupChip
						key={chipGroup}
						group={chipGroup}
						isSelected={group === chipGroup}
						onClick={() => {
							setGroup((current) => (current === chipGroup ? null : chipGroup))
						}}
					/>
				))}
			</div>
			<div className="flex touch-pan-y flex-col">
				{items?.map((item) => (
					<ExerciseResultRow
						key={item.id}
						exercise={item}
						onAdd={() => {
							onPick({
								name: item.name,
								exerciseId: item.id,
								kind: item.kind,
								muscleGroup: item.muscleGroup,
								lastSets: item.lastSets,
							})
						}}
					/>
				))}
				{!items && dictionary.isError && (
					<InlineError
						message={t('program.editor.search.loadError')}
						onRetry={() => void dictionary.refetch()}
					/>
				)}
				{dictionary.isPending && (
					<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2">
						{Array.from({ length: SKELETON_ROWS }, (_, index) => (
							<Skeleton key={index} shape="block" className="h-11 w-full" />
						))}
					</div>
				)}
				{items?.length === 0 && name === '' && (
					<Text variant="caption" tone="muted" weight="regular">
						{t('program.editor.search.empty')}
					</Text>
				)}
			</div>
			{name !== '' && !isNameKnown && (
				<DashedAction onClick={addNew} className="text-card-title">
					<span className="truncate">{t('program.editor.newExercise', { name })}</span>
				</DashedAction>
			)}
		</BaseBottomSheet>
	)
}
