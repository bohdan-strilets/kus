import type { RecipeDetail } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { MACRO_ORDER, MacroTile } from '@/entities/stats'
import { formatInteger } from '@/shared/lib'
import { Text } from '@/shared/ui'

/** mockups/recipe-detail.html: «Ккал» and Б → В → Ж per one portion, no goals (a recipe has none). */
export const RecipeMacroTiles = ({ recipe }: { recipe: RecipeDetail }) => {
	const { t } = useTranslation()

	return (
		<div className="grid grid-cols-4 gap-1.5">
			<div className="flex flex-col items-center gap-0.5 rounded-tile-sm bg-primary-soft px-1.5 py-2">
				<Text as="span" variant="small" weight="regular" tone="primaryDeep">
					{t('recipes.detail.kcal')}
				</Text>
				<Text as="span" variant="caption" weight="extrabold" isTabular>
					{formatInteger(recipe.kcal)}
				</Text>
			</div>
			{MACRO_ORDER.map((macro) => (
				<MacroTile
					key={macro}
					macro={macro}
					variant="compact"
					progress={{ value: recipe[macro], goal: null }}
				/>
			))}
		</div>
	)
}
