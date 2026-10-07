import { useTranslation } from 'react-i18next'

import {
	FALLBACK_FOOD_CATEGORY,
	FOOD_CATEGORIES,
	type FoodCategory,
	FoodIcon,
	type FoodIconSize,
	getFoodCategoryLabelKey,
	Text,
} from '@/shared/ui'

import { DevSection } from '../DevSection'

const SIZES: readonly FoodIconSize[] = ['row', 'meal', 'recipe']
/** A few categories in every size, the rest of the pack at the day-list size below. */
const SIZE_SAMPLES: readonly (FoodCategory | null)[] = ['eggs', 'soup', 'pizza', null]

export const FoodIconsSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.foodIcons')}>
			<div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
				{SIZE_SAMPLES.map((category) => (
					<div key={category ?? 'null'} className="flex items-center gap-3">
						{SIZES.map((size) => (
							<FoodIcon key={size} category={category} size={size} />
						))}
						<Text as="span" variant="small" tone="muted">
							{t(getFoodCategoryLabelKey(category ?? FALLBACK_FOOD_CATEGORY))}
						</Text>
					</div>
				))}
			</div>
			<div className="grid grid-cols-5 gap-2 rounded-card bg-surface p-3 shadow-card">
				{FOOD_CATEGORIES.map((category) => (
					<div key={category} className="flex flex-col items-center gap-1 py-1">
						<FoodIcon category={category} size="meal" />
						<Text as="span" variant="small" tone="muted" className="text-center">
							{t(getFoodCategoryLabelKey(category))}
						</Text>
					</div>
				))}
			</div>
		</DevSection>
	)
}
