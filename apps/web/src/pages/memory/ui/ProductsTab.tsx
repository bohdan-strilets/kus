import type { MyFoodResponse } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import {
	filterMyFoods,
	MyFoodRow,
	myFoodsQueryOptions,
	shouldShowSearch,
	sortMyFoodsByName,
} from '@/entities/my-food'
import { EditMyFoodSheet } from '@/features/edit-my-food'
import { ROUTES } from '@/shared/config'
import { Button, InlineError, RowGroup, Text } from '@/shared/ui'

import { ListSkeleton } from './ListSkeleton'
import { MemoryEmpty } from './MemoryEmpty'
import { ProductSearch } from './ProductSearch'

/** «Продукти» (mockups/memory-products.html): the list by name, the search past 15, the sheet of a product. */
export const ProductsTab = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const query = useQuery(myFoodsQueryOptions)
	const [search, setSearch] = useState('')
	const [selected, setSelected] = useState<MyFoodResponse | null>(null)
	const foods = useMemo(() => sortMyFoodsByName(query.data ?? []), [query.data])
	const hasSearch = shouldShowSearch(foods.length)
	const searchText = hasSearch ? search.trim() : ''
	const shownFoods = useMemo(() => filterMyFoods(foods, searchText), [foods, searchText])

	const renderList = (): ReactNode => {
		if (query.isPending) return <ListSkeleton hasIcon />
		if (query.isError && !query.data) {
			return (
				<InlineError
					message={t('memory.products.loadError')}
					onRetry={() => void query.refetch()}
				/>
			)
		}
		if (foods.length === 0) {
			return (
				<MemoryEmpty
					title={t('memory.products.empty.title')}
					text={t('memory.products.empty.text')}
					action={
						<Button onClick={() => void navigate(ROUTES.chat)}>
							{t('memory.products.empty.action')}
						</Button>
					}
				/>
			)
		}
		return (
			<>
				{hasSearch && <ProductSearch value={search} onChange={setSearch} />}
				{searchText !== '' && shownFoods.length > 0 && (
					<Text variant="eyebrow" tone="muted" className="px-1" role="status">
						{t('memory.products.search.found', { count: shownFoods.length })}
					</Text>
				)}
				{shownFoods.length > 0 ? (
					<RowGroup>
						{shownFoods.map((food) => (
							<MyFoodRow key={food.id} food={food} onSelect={setSelected} />
						))}
					</RowGroup>
				) : (
					<Text tone="mutedStrong" className="px-5 pt-4 text-center" role="status">
						{t('memory.products.search.nothing', { query: searchText })}
					</Text>
				)}
			</>
		)
	}

	return (
		<>
			{renderList()}
			{/* always mounted: «Скасувати» in the toast of a delete outlives the list that held the row */}
			<EditMyFoodSheet
				food={selected}
				onClose={() => {
					setSelected(null)
				}}
			/>
		</>
	)
}
