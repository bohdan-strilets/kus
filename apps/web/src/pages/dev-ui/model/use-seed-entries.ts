import { useTranslation } from 'react-i18next'

import type { FoodEntryView } from '@/entities/entry'

import { SEED_BREAKFAST } from './seed'

/** The breakfast from mockups/chat.html as entries, with names from uk.dev.json. */
export const useSeedEntries = () => {
	const { t } = useTranslation()

	const eggs: FoodEntryView = {
		id: 'eggs',
		name: t('devUi.seed.eggs'),
		amount: t('devUi.seed.eggsAmount'),
		kcal: SEED_BREAKFAST.eggsKcal,
		icon: 'egg',
	}
	const buckwheat: FoodEntryView = {
		id: 'buckwheat',
		name: t('devUi.seed.buckwheat'),
		amount: t('devUi.seed.buckwheatAmount'),
		kcal: SEED_BREAKFAST.buckwheatKcal,
		icon: 'buckwheat',
		captionState: 'hint',
		hint: t('devUi.seed.buckwheatHint'),
	}
	const coffee: FoodEntryView = {
		id: 'coffee',
		name: t('devUi.seed.coffee'),
		amount: t('devUi.seed.coffeeAmount'),
		kcal: SEED_BREAKFAST.coffeeKcal,
		icon: 'coffee',
		captionState: 'usual',
	}
	const unknown: FoodEntryView = {
		id: 'pie',
		name: t('devUi.seed.unknownFood'),
		amount: t('devUi.seed.unknownAmount'),
		kcal: 280,
	}

	return { eggs, buckwheat, coffee, unknown }
}
