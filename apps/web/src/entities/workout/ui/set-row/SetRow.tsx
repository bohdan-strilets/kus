import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Text } from '@/shared/ui'

import { formatSetReps, formatSetWeight } from '../../lib/set-edit'

export interface SetRowProps {
	/** «1», «2» or «Р» for a warm-up. */
	label: string
	/** «Підхід 2, змінити». */
	ariaLabel: string
	reps: number | null
	/** Null: a bodyweight exercise, no weight to show. */
	weightKg: number | null
	hasWeight: boolean
	isWarmup: boolean
	isDone: boolean
	/** Makes the row the set being edited; without it the row only shows. */
	onSelect?: () => void
	/** «✓» of the live mode, «змінено» of the form. */
	trailing?: ReactNode
}

/**
 * A set of the list (mockups/training-live.html): «52,5 кг × 12 повт.». Done — `success-soft`,
 * a warm-up — dashed with «Р». The row and the trailing control are siblings, so no button holds a button.
 */
export const SetRow = ({
	label,
	ariaLabel,
	reps,
	weightKg,
	hasWeight,
	isWarmup,
	isDone,
	onSelect,
	trailing,
}: SetRowProps) => {
	const { t } = useTranslation()
	const content = (
		<>
			<Text as="span" variant="small" tone="muted" className="w-4 flex-none text-center">
				{label}
			</Text>
			<span className="flex min-w-0 flex-1 items-baseline gap-1">
				{hasWeight && (
					<>
						<Text as="span" className="text-name font-extrabold" isTabular>
							{formatSetWeight(weightKg)}
						</Text>
						<Text as="span" variant="small" tone="muted">
							{t('program.editor.unitKg')}
						</Text>
						<Text as="span" variant="small" tone="muted">
							×
						</Text>
					</>
				)}
				<Text as="span" className="text-name font-extrabold" isTabular>
					{formatSetReps(reps)}
				</Text>
				<Text as="span" variant="small" tone="muted">
					{t('workout.repsUnit')}
				</Text>
			</span>
		</>
	)

	return (
		<div
			className={cn(
				'flex min-h-14 items-center gap-1 rounded-tile pr-1.5 pl-3',
				isDone ? 'bg-success-soft' : 'bg-field',
				isWarmup && 'border-2 border-dashed border-line-strong',
			)}
		>
			{onSelect ? (
				<button
					type="button"
					aria-label={ariaLabel}
					onClick={onSelect}
					className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
				>
					{content}
				</button>
			) : (
				<div className="flex min-h-14 min-w-0 flex-1 items-center gap-2">{content}</div>
			)}
			{trailing}
		</div>
	)
}
