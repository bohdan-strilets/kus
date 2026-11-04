import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { StepValue, Text } from '@/shared/ui'

import { formatSetReps, formatSetWeight } from '../../lib/set-edit'

export interface SetRowProps {
	/** «1», «2» or «розм.» for a warm-up. */
	label: string
	/** «Підхід 2, змінити». */
	ariaLabel: string
	reps: number | null
	/** Null: a bodyweight exercise, no weight to show. */
	weightKg: number | null
	hasWeight: boolean
	isWarmup: boolean
	isDone: boolean
	/** Differs from the plan (the form): a highlighted row; the «змінено» in `trailing` says it too. */
	isChanged?: boolean
	/** Makes the row the set being edited; without it the row only shows. */
	onSelect?: () => void
	/** «✓» of the live mode, «змінено» of the form. */
	trailing?: ReactNode
}

/**
 * A row of the table «Підхід · Вага · Повтори» (mockups/training-live.html): «2 · 52,5 кг · 12 повт.», no «×» —
 * the columns say what is what. Done — `success-soft`, a warm-up — dashed with «розм.». The row and the
 * trailing control are siblings, so no button holds a button.
 */
export const SetRow = ({
	label,
	ariaLabel,
	reps,
	weightKg,
	hasWeight,
	isWarmup,
	isDone,
	isChanged = false,
	onSelect,
	trailing,
}: SetRowProps) => {
	const { t } = useTranslation()
	const numberTone = isDone ? 'successInk' : 'ink'
	const numberClassName = cn('text-title', isChanged && 'text-muscle-arms-ink')
	const content = (
		<>
			<Text as="span" variant="caption" tone="muted" weight="extrabold" className="w-11 flex-none">
				<StepValue text={label} direction={0} />
			</Text>
			{hasWeight && (
				<span className="min-w-0 flex-1 basis-0">
					<Text as="span" className={numberClassName} tone={numberTone} isTabular>
						{formatSetWeight(weightKg)}
					</Text>
					<Text as="span" variant="caption" tone="muted">
						{' '}
						{t('program.editor.unitKg')}
					</Text>
				</span>
			)}
			<span className="min-w-0 flex-1 basis-0">
				<Text as="span" className={numberClassName} tone={numberTone} isTabular>
					{formatSetReps(reps)}
				</Text>
				<Text as="span" variant="caption" tone="muted">
					{' '}
					{t('workout.repsUnit')}
				</Text>
			</span>
		</>
	)

	return (
		<div
			className={cn(
				'flex min-h-14 items-center gap-1 rounded-tile pr-1.5 pl-3',
				isDone ? 'bg-success-soft' : isChanged ? 'bg-muscle-arms-bg' : 'bg-field',
				isWarmup && 'border-2 border-dashed border-line-strong',
			)}
		>
			{onSelect ? (
				<button
					type="button"
					aria-label={ariaLabel}
					onClick={onSelect}
					className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
				>
					{content}
				</button>
			) : (
				<div className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5">{content}</div>
			)}
			{trailing}
		</div>
	)
}
