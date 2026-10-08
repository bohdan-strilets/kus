import { useTranslation } from 'react-i18next'

import { cn, formatInteger } from '@/shared/lib'
import { ProgressBar, Text } from '@/shared/ui'

import type { MacroKey, MacroProgress } from '../../model/macro.types'
import { MACRO_INK_CLASS, macroTileVariants } from './macro-tile.variants'

export interface MacroTileProps {
	macro: MacroKey
	progress: MacroProgress
	variant?: 'compact' | 'bar'
	/** Position in the row: bars fill one after another. */
	index?: number
}

const LABEL_KEY = {
	protein: 'macro.protein',
	carbs: 'macro.carbs',
	fat: 'macro.fat',
} as const

/**
 * docs MacroTiles / MacroBar. compact (chat): «Білки» 12 + «78/140» 13/800; carbs is «Вугл.».
 * bar (today): «Білки» 12/600 + «78 / 140 г» 15/800 and a 5px bar on a white track.
 */
export const MacroTile = ({ macro, progress, variant = 'bar', index = 0 }: MacroTileProps) => {
	const { t } = useTranslation()
	const ink = MACRO_INK_CLASS[macro]
	const isCompact = variant === 'compact'
	const label = isCompact && macro === 'carbs' ? t('macro.carbsShort') : t(LABEL_KEY[macro])
	const value = formatInteger(progress.value)
	const goal = progress.goal === null ? null : formatInteger(progress.goal)

	const renderGoal = () => {
		if (goal === null) {
			return isCompact ? null : (
				<span className={cn('text-small font-medium', ink)}>{t('macro.grams')}</span>
			)
		}
		return (
			<span className={cn('font-medium', ink, !isCompact && 'text-small')}>
				{isCompact ? t('macro.ofGoalShort', { goal }) : t('macro.ofGoalGrams', { goal })}
			</span>
		)
	}

	return (
		<div className={macroTileVariants({ macro, variant })}>
			<Text as="span" variant="small" weight={isCompact ? 'regular' : 'semibold'} className={ink}>
				{label}
			</Text>
			<Text as="span" variant={isCompact ? 'caption' : 'body'} weight="extrabold" isTabular>
				{value}
				{renderGoal()}
			</Text>
			{!isCompact && progress.goal !== null && (
				<ProgressBar
					label={label}
					value={progress.value}
					max={progress.goal}
					tone={macro}
					track="white"
					index={index}
				/>
			)}
		</div>
	)
}
