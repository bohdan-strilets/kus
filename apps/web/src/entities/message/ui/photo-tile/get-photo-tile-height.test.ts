import { describe, expect, it } from 'vitest'

import { getPhotoTileHeight } from './get-photo-tile-height'
import {
	PHOTO_TILE_MAX_HEIGHT_PX,
	PHOTO_TILE_MIN_HEIGHT_PX,
	PHOTO_TILE_WIDTH_PX,
} from './photo-tile.constants'

describe('getPhotoTileHeight', () => {
	it('follows the proportions of a 4:3 landscape photo', () => {
		expect(getPhotoTileHeight(1568, 1176)).toBe(186)
	})

	it('is square for 1:1', () => {
		expect(getPhotoTileHeight(1000, 1000)).toBe(PHOTO_TILE_WIDTH_PX)
	})

	it('crops a 3:1 panorama to the minimum', () => {
		expect(getPhotoTileHeight(1500, 500)).toBe(PHOTO_TILE_MIN_HEIGHT_PX)
	})

	it('crops a 9:16 portrait to the maximum', () => {
		expect(getPhotoTileHeight(900, 1600)).toBe(PHOTO_TILE_MAX_HEIGHT_PX)
	})

	it('keeps the exact boundaries as they are', () => {
		expect(getPhotoTileHeight(200, 100)).toBe(PHOTO_TILE_MIN_HEIGHT_PX)
		expect(getPhotoTileHeight(PHOTO_TILE_WIDTH_PX, PHOTO_TILE_MAX_HEIGHT_PX)).toBe(
			PHOTO_TILE_MAX_HEIGHT_PX,
		)
	})

	it('stays inside the range one pixel past each boundary', () => {
		expect(getPhotoTileHeight(200, 99)).toBe(PHOTO_TILE_MIN_HEIGHT_PX)
		expect(getPhotoTileHeight(PHOTO_TILE_WIDTH_PX, PHOTO_TILE_MAX_HEIGHT_PX - 1)).toBe(
			PHOTO_TILE_MAX_HEIGHT_PX - 1,
		)
		expect(getPhotoTileHeight(PHOTO_TILE_WIDTH_PX, PHOTO_TILE_MAX_HEIGHT_PX + 1)).toBe(
			PHOTO_TILE_MAX_HEIGHT_PX,
		)
	})

	it('rounds to a whole pixel', () => {
		// 248 * 2 / 3 = 165.33
		expect(getPhotoTileHeight(3, 2)).toBe(165)
		// 248 * 601 / 496 = 300.5 rounds up
		expect(getPhotoTileHeight(496, 601)).toBe(301)
	})

	it.each([
		['zero width', 0, 600],
		['zero height', 800, 0],
		['both zero', 0, 0],
		['negative width', -800, 600],
		['negative height', 800, -600],
		['NaN width', Number.NaN, 600],
		['Infinity height', 800, Number.POSITIVE_INFINITY],
	])('gives a finite height inside the range for %s', (_name, width, height) => {
		const result = getPhotoTileHeight(width, height)

		expect(Number.isFinite(result)).toBe(true)
		expect(result).toBeGreaterThanOrEqual(PHOTO_TILE_MIN_HEIGHT_PX)
		expect(result).toBeLessThanOrEqual(PHOTO_TILE_MAX_HEIGHT_PX)
	})
})
