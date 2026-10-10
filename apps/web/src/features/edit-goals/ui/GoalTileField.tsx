import { useTranslation } from 'react-i18next'

import { NumberField } from '@/shared/ui'

import { goalTileFieldVariants, type GoalTileTone } from './goal-tile-field.variants'

interface GoalTileFieldProps {
	tone: GoalTileTone
	label: string
	value: string
	onChange: (value: string) => void
	onBlur: () => void
	name: string
	/** «розраховано 2 200»; null — the line is not shown. */
	calculatedText: string | null
	error?: string
	attemptCount: number
}

/** A number inside a tile of its macro's colour; the field itself has no background of its own. */
export const GoalTileField = ({
	tone,
	label,
	value,
	onChange,
	onBlur,
	name,
	calculatedText,
	error,
	attemptCount,
}: GoalTileFieldProps) => {
	const { t } = useTranslation()
	const isKcal = tone === 'kcal'

	return (
		<div className={goalTileFieldVariants({ tone, hasError: Boolean(error) })}>
			{/* the tile owns padding and rings, so the error and the hint sit inside it */}
			<NumberField
				size="sm"
				label={label}
				unit={isKcal ? t('editGoals.kcalUnit') : t('editGoals.gramUnit')}
				value={value}
				onChange={onChange}
				onBlur={onBlur}
				name={name}
				inputMode="numeric"
				error={error}
				attemptCount={attemptCount}
				className="rounded-none p-0 ring-0 focus-within:ring-0"
			/>
			{calculatedText !== null && <span className="text-small">{calculatedText}</span>}
		</div>
	)
}
