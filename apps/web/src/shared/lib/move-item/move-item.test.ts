import { describe, expect, it } from 'vitest'

import { moveItem, moveItemBy, orderByKeys } from './move-item'

const makeItems = () => [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
const getKey = (item: { key: string }): string => item.key
const keysOf = (list: readonly { key: string }[]): string[] => list.map(getKey)

describe('moveItem', () => {
	it('moves an item forward and back', () => {
		expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
		expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
	})

	it('returns a copy when from equals to', () => {
		const list = ['a', 'b']
		const result = moveItem(list, 1, 1)
		expect(result).toEqual(list)
		expect(result).not.toBe(list)
	})

	it.each([
		[-1, 0],
		[0, -1],
		[3, 0],
		[0, 3],
		[0.5, 1],
		[Number.NaN, 1],
	])('returns a copy for the invalid indexes %s -> %s', (from, to) => {
		const list = ['a', 'b', 'c']
		const result = moveItem(list, from, to)
		expect(result).toEqual(list)
		expect(result).not.toBe(list)
	})

	it('handles an empty list and a single item', () => {
		expect(moveItem([], 0, 0)).toEqual([])
		expect(moveItem(['a'], 0, 1)).toEqual(['a'])
	})

	it('keeps the item references and does not mutate the input', () => {
		const items = makeItems()
		const result = moveItem(items, 0, 2)
		expect(keysOf(items)).toEqual(['a', 'b', 'c'])
		expect(result[2]).toBe(items[0])
		expect(result[0]).toBe(items[1])
	})
})

describe('moveItemBy', () => {
	it('moves one step up or down', () => {
		expect(moveItemBy(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
		expect(moveItemBy(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
	})

	it('keeps the order at the start and the end of the list', () => {
		expect(moveItemBy(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
		expect(moveItemBy(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
	})

	it('keeps a single item, an empty list and an unknown index', () => {
		expect(moveItemBy(['a'], 0, 1)).toEqual(['a'])
		expect(moveItemBy([], 0, 1)).toEqual([])
		expect(moveItemBy(['a', 'b'], -1, 1)).toEqual(['a', 'b'])
	})
})

describe('orderByKeys', () => {
	it('orders the list by the keys, keeping the references', () => {
		const items = makeItems()
		const result = orderByKeys(items, ['c', 'a', 'b'], getKey)
		expect(keysOf(result)).toEqual(['c', 'a', 'b'])
		expect(result[0]).toBe(items[2])
		expect(keysOf(items)).toEqual(['a', 'b', 'c'])
	})

	it('keeps the list when a key is lost', () => {
		const items = makeItems()
		const result = orderByKeys(items, ['c', 'a'], getKey)
		expect(result).toEqual(items)
		expect(result).not.toBe(items)
	})

	it('keeps the list when a key is invented', () => {
		const items = makeItems()
		expect(keysOf(orderByKeys(items, ['c', 'x', 'b'], getKey))).toEqual(['a', 'b', 'c'])
	})

	it('keeps the list when the keys have an extra entry', () => {
		const items = makeItems()
		expect(keysOf(orderByKeys(items, ['c', 'a', 'b', 'a'], getKey))).toEqual(['a', 'b', 'c'])
	})

	it('handles an empty list', () => {
		expect(orderByKeys([], [], getKey)).toEqual([])
	})
})
