import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Chip } from '@/shared/ui'

import { DevSection } from '../DevSection'

const QUICK_CHIP_KEYS = [
	'devUi.level0.weekSummary',
	'devUi.level0.addWeight',
	'devUi.level0.myRecipes',
] as const
const SELECT_CHIP_KEYS = [
	'devUi.level0.fish',
	'devUi.level0.pork',
	'devUi.level0.dairy',
	'devUi.level0.mushrooms',
] as const
type SelectChipKey = (typeof SELECT_CHIP_KEYS)[number]

export const ChipsBadgesSection = () => {
	const { t } = useTranslation()
	// «Рибу» is selected in mockups/onboarding-4-food.html
	const [selected, setSelected] = useState<ReadonlySet<SelectChipKey>>(
		() => new Set(['devUi.level0.fish']),
	)

	const toggle = (key: SelectChipKey): void => {
		setSelected((current) => {
			const next = new Set(current)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	return (
		<>
			<DevSection title={t('devUi.sections.chips')}>
				<div className="scrollbar-none flex gap-2 overflow-x-auto">
					{QUICK_CHIP_KEYS.map((key) => (
						<Chip key={key}>{t(key)}</Chip>
					))}
				</div>
				<div className="flex flex-wrap gap-2">
					{SELECT_CHIP_KEYS.map((key) => (
						<Chip
							key={key}
							variant="select"
							isSelected={selected.has(key)}
							onClick={() => {
								toggle(key)
							}}
						>
							{t(key)}
						</Chip>
					))}
				</div>
			</DevSection>

			<DevSection title={t('devUi.sections.badges')}>
				<div className="flex flex-wrap items-center gap-4">
					<Badge variant="kcal">{t('devUi.level0.kcal')}</Badge>
					<Badge variant="success" label={t('devUi.level0.logged')} />
					<Badge variant="notice" label={t('devUi.level0.newSummary')} />
					<Badge variant="failed">{t('devUi.level0.notSent')}</Badge>
				</div>
			</DevSection>
		</>
	)
}
