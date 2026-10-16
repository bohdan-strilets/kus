import {
	PHOTO_TILE_MAX_HEIGHT_PX,
	PHOTO_TILE_MIN_HEIGHT_PX,
	PHOTO_TILE_WIDTH_PX,
} from './photo-tile.constants'

/** Known before the picture loads (the size comes from the API), so the feed never jumps. */
export const getPhotoTileHeight = (width: number, height: number): number => {
	// 0/0 or NaN would make the height NaN and the tile collapse
	if (!(width > 0 && height > 0)) return PHOTO_TILE_MIN_HEIGHT_PX
	const proportional = Math.round((PHOTO_TILE_WIDTH_PX * height) / width)
	return Math.min(PHOTO_TILE_MAX_HEIGHT_PX, Math.max(PHOTO_TILE_MIN_HEIGHT_PX, proportional))
}
