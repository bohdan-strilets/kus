import { useTranslation } from 'react-i18next'

import { FoodIcon, type FoodIconKind, type FoodIconSize, Text } from '@/shared/ui'

import { DevSection } from '../DevSection'

// kind names are code identifiers, shown as-is
const KINDS: readonly FoodIconKind[] = [
	'egg',
	'buckwheat',
	'coffee',
	'chickenBuckwheat',
	'soup',
	'banana',
	'pizza',
	'plate',
]
const SIZES: readonly FoodIconSize[] = ['row', 'meal', 'recipe']

export const FoodIconsSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.foodIcons')}>
			<div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
				{KINDS.map((kind) => (
					<div key={kind} className="flex items-center gap-3">
						{SIZES.map((size) => (
							<FoodIcon key={size} kind={kind} size={size} />
						))}
						<Text as="span" variant="small" tone="muted">
							{kind}
						</Text>
					</div>
				))}
			</div>
		</DevSection>
	)
}
