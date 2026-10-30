import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { factsQueryOptions } from '@/entities/fact'
import { myFoodsQueryOptions } from '@/entities/my-food'
import { MEMORY_TAB_PARAM, ROUTES } from '@/shared/config'
import { ScreenHeader } from '@/shared/ui'

import { getMemorySubtitle } from '../lib/get-memory-subtitle'
import { getMemoryTab } from '../lib/get-memory-tab'
import { FactsTab } from './FactsTab'
import { type MemoryTab, MemoryTabs } from './MemoryTabs'
import { ProductsTab } from './ProductsTab'

/**
 * «Пам'ять» behind the profile (mockups/memory-products.html, memory-facts.html): what Kusik
 * remembers — the foods and the facts about you. No bottom nav, «Назад» goes to the profile.
 */
export const MemoryPage = () => {
	const { t } = useTranslation()
	const [searchParams, setSearchParams] = useSearchParams()
	const tab = getMemoryTab(searchParams.get(MEMORY_TAB_PARAM))
	// replace: switching tabs is not a step «Назад» should walk back through
	const selectTab = (next: MemoryTab): void => {
		setSearchParams(next === 'products' ? {} : { [MEMORY_TAB_PARAM]: next }, { replace: true })
	}
	// the same queries the tabs read: one request each, and the counts follow every edit
	const productsCount = useQuery(myFoodsQueryOptions).data?.length ?? null
	const factsCount = useQuery(factsQueryOptions).data?.length ?? null

	return (
		<>
			<ScreenHeader
				title={t('pages.memory.title')}
				subtitle={getMemorySubtitle({ productsCount, factsCount }, t)}
				backTo={ROUTES.profile}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-gutter pt-2.5 pb-5">
				<MemoryTabs
					value={tab}
					onValueChange={selectTab}
					productsPanel={<ProductsTab />}
					factsPanel={<FactsTab />}
				/>
			</div>
		</>
	)
}
