import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import { type AiImageInput, type AiImageMimeType, PHOTO_MAX_BYTES } from '@kus/shared'
import { imageSize } from 'image-size'

/** The app sends at most this long side (compress-image.ts); a bigger eval photo would not compare like for like. */
export const EVAL_PHOTO_MAX_SIDE_PX = 1568
/** Claude ≥ 4.7 bills one visual token per 28×28 patch (platform.claude.com → Vision). */
const PATCH_PX = 28

const MIME_BY_EXTENSION: Record<string, AiImageMimeType> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
}

/** A case photo as the model gets it, plus its size for the cost estimate. */
export interface EvalPhoto extends AiImageInput {
	width: number
	height: number
}

export const getImageTokens = (width: number, height: number): number =>
	Math.ceil(width / PATCH_PX) * Math.ceil(height / PATCH_PX)

/**
 * Reads a photo of a private case. The file is not resized: the author puts in what the app
 * would send; anything outside the app's limits only gets a warning, so the run still goes.
 */
export const loadEvalPhoto = async (
	dir: string,
	relativePath: string,
	warn: (message: string) => void,
): Promise<EvalPhoto> => {
	const mimeType = MIME_BY_EXTENSION[extname(relativePath).toLowerCase()]
	if (!mimeType) throw new Error(`${relativePath}: a case photo must be .jpg, .png or .webp`)
	const bytes = await readFile(join(dir, relativePath))
	const { width, height } = imageSize(bytes)
	if (bytes.length > PHOTO_MAX_BYTES) {
		warn(`${relativePath}: ${bytes.length} bytes — the API refuses more than ${PHOTO_MAX_BYTES}`)
	}
	if (Math.max(width, height) > EVAL_PHOTO_MAX_SIDE_PX) {
		warn(
			`${relativePath}: ${width}×${height} px — the app sends at most ${EVAL_PHOTO_MAX_SIDE_PX} px on the long side`,
		)
	}
	return { mimeType, base64: bytes.toString('base64'), width, height }
}
