import {
	COMPRESSION_ATTEMPTS,
	type CompressionAttempt,
	getTargetSize,
	PHOTO_TARGET_BYTES,
	PhotoError,
	THUMB_COMPRESSION_ATTEMPTS,
	THUMB_TARGET_BYTES,
} from './compress-image.helpers'

export interface CompressedPhoto {
	/** image/jpeg, ready to preview. */
	blob: Blob
	/** The same bytes without the `data:` prefix: what POST /photos takes. */
	base64: string
	/** Size of the full photo, from the canvas it was drawn on. */
	width: number
	height: number
	/** The thumbnail JPEG, base64 without the `data:` prefix. */
	thumbBase64: string
}

interface EncodedImage {
	blob: Blob
	width: number
	height: number
}

const JPEG_MIME_TYPE = 'image/jpeg'

const decodeImage = async (url: string): Promise<HTMLImageElement> => {
	const image = new Image()
	image.src = url
	try {
		await image.decode()
	} catch {
		// HEIC outside Safari, a broken or non-image file
		throw new PhotoError('unsupported')
	}
	if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new PhotoError('unsupported')
	return image
}

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
	new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob)
				else reject(new PhotoError('unsupported'))
			},
			JPEG_MIME_TYPE,
			quality,
		)
	})

const blobToBase64 = (blob: Blob): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const result = typeof reader.result === 'string' ? reader.result : ''
			resolve(result.slice(result.indexOf(',') + 1))
		}
		reader.onerror = () => {
			reject(new PhotoError('unsupported'))
		}
		reader.readAsDataURL(blob)
	})

/** Draws through a canvas, so the Exif (and the GPS in it) is gone; the first attempt that fits wins. */
const encodeWithin = async (
	image: HTMLImageElement,
	attempts: readonly CompressionAttempt[],
	maxBytes: number,
): Promise<EncodedImage> => {
	for (const { maxSide, quality } of attempts) {
		const size = getTargetSize(image.naturalWidth, image.naturalHeight, maxSide)
		const canvas = document.createElement('canvas')
		canvas.width = size.width
		canvas.height = size.height
		const context = canvas.getContext('2d')
		if (!context) throw new PhotoError('unsupported')
		context.drawImage(image, 0, 0, size.width, size.height)
		const blob = await canvasToBlob(canvas, quality)
		// Safari keeps the bitmap of a canvas until it is resized to nothing: up to 4 per photo
		canvas.width = 0
		canvas.height = 0
		if (blob.size <= maxBytes) return { blob, ...size }
	}
	throw new PhotoError('tooLarge')
}

/**
 * Shrinks a picked photo to what the model needs: JPEG, the long side ≤ 1568 px, under 1 MB, plus
 * its thumbnail (long side ≤ 768 px, ≤ 150 KB). The <img> has already applied the orientation.
 */
export const compressImage = async (file: File): Promise<CompressedPhoto> => {
	const url = URL.createObjectURL(file)
	try {
		const image = await decodeImage(url)
		const full = await encodeWithin(image, COMPRESSION_ATTEMPTS, PHOTO_TARGET_BYTES)
		const thumb = await encodeWithin(image, THUMB_COMPRESSION_ATTEMPTS, THUMB_TARGET_BYTES)
		return {
			blob: full.blob,
			base64: await blobToBase64(full.blob),
			width: full.width,
			height: full.height,
			thumbBase64: await blobToBase64(thumb.blob),
		}
	} finally {
		URL.revokeObjectURL(url)
	}
}
