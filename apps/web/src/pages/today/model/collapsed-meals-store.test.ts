import { beforeEach, describe, expect, it } from 'vitest'

import { useCollapsedMealsStore } from './collapsed-meals-store'

describe('useCollapsedMealsStore', () => {
	beforeEach(() => {
		useCollapsedMealsStore.setState({ collapsedIds: {} })
	})

	it('starts with every meal open and folds one per tap', () => {
		const { toggle } = useCollapsedMealsStore.getState()
		expect(useCollapsedMealsStore.getState().collapsedIds).toEqual({})

		toggle('breakfast')
		toggle('lunch')
		expect(useCollapsedMealsStore.getState().collapsedIds).toEqual({ breakfast: true, lunch: true })

		toggle('breakfast')
		expect(useCollapsedMealsStore.getState().collapsedIds).toEqual({ lunch: true })
	})
})
