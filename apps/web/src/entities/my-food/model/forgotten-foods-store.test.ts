import { beforeEach, describe, expect, it } from 'vitest'

import { useForgottenFoodsStore } from './forgotten-foods-store'

const bar = { id: '0199b3a4-0000-7000-8000-000000000001', name: 'Батончик' }
const skyr = { id: '0199b3a4-0000-7000-8000-000000000002', name: 'Скир' }

describe('useForgottenFoodsStore', () => {
	beforeEach(() => {
		useForgottenFoodsStore.setState({ foods: [] })
	})

	it('collects announced foods and gives them out once', () => {
		useForgottenFoodsStore.getState().announce([bar])
		useForgottenFoodsStore.getState().announce([skyr])

		expect(useForgottenFoodsStore.getState().take()).toEqual([bar, skyr])
		expect(useForgottenFoodsStore.getState().take()).toEqual([])
	})

	it('ignores an empty announcement (a repeated turn)', () => {
		const before = useForgottenFoodsStore.getState().foods
		useForgottenFoodsStore.getState().announce([])

		expect(useForgottenFoodsStore.getState().foods).toBe(before)
	})
})
