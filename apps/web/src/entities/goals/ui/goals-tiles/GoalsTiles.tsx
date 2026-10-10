import type { ProfileGoals } from '@kus/shared'
import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'

import { cn, formatInteger } from '@/shared/lib'

import { GOAL_TILE_LABEL_INK, type GoalTileTone, goalTileVariants } from './goals-tiles.variants'

export interface GoalsTilesProps {
	/** null: the goal isn't set yet, every tile shows «—». */
	goals: ProfileGoals | null
}

interface TileConfig {
	tone: GoalTileTone
	labelKey: ParseKeys
	isGrams: boolean
	getValue: (goals: ProfileGoals) => number
}

// kcal first, then protein, carbs, fat: the order of the macros everywhere
const TILES: TileConfig[] = [
	{ tone: 'kcal', labelKey: 'profile.goals.kcal', isGrams: false, getValue: (g) => g.kcal },
	{
		tone: 'protein',
		labelKey: 'profile.goals.protein',
		isGrams: true,
		getValue: (g) => g.proteinG,
	},
	{ tone: 'carbs', labelKey: 'profile.goals.carbs', isGrams: true, getValue: (g) => g.carbsG },
	{ tone: 'fat', labelKey: 'profile.goals.fat', isGrams: true, getValue: (g) => g.fatG },
]

/** profile: the day's goals as a 2×2 grid. */
export const GoalsTiles = ({ goals }: GoalsTilesProps) => {
	const { t } = useTranslation()

	const renderValue = ({ isGrams, getValue }: TileConfig): string => {
		if (goals === null) return t('profile.goals.empty')
		const value = formatInteger(getValue(goals))
		return isGrams ? t('profile.goals.grams', { value }) : value
	}

	return (
		<div className="grid grid-cols-2 gap-2">
			{TILES.map((tile) => (
				<div key={tile.tone} className={goalTileVariants({ tone: tile.tone })}>
					<span className={cn('text-small font-semibold', GOAL_TILE_LABEL_INK[tile.tone])}>
						{t(tile.labelKey)}
					</span>
					<span className="text-title text-ink tabular-nums">{renderValue(tile)}</span>
				</div>
			))}
		</div>
	)
}
