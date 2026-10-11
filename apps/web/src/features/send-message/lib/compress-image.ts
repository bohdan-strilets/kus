import {
	COMPRESSION_ATTEMPTS,
	getTargetSize,
	PHOTO_TARGET_BYTES,
	PhotoError,
} from './compress-image.helpers'

export interface CompressedPhoto {
	/** image/jpeg, ready to preview. */
	blob: Blob
	/** The same bytes without the `data:` prefix: what POST /messages takes. */
	base64: string
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

/**
 * Shrinks a picked photo to what the model needs: JPEG, the long side ≤ 1568 px, under 1 MB. The
 * canvas drops the Exif (and the GPS in it); the <img> has already applied the orientation.
 */
export const compressImage = async (file: File): Promise<CompressedPhoto> => {
	const url = URL.createObjectURL(file)
	try {
		const image = await decodeImage(url)
		for (const { maxSide, quality } of COMPRESSION_ATTEMPTS) {
			const size = getTargetSize(image.naturalWidth, image.naturalHeight, maxSide)
			const canvas = document.createElement('canvas')
			canvas.width = size.width
			canvas.height = size.height
			const context = canvas.getContext('2d')
			if (!context) throw new PhotoError('unsupported')
			context.drawImage(image, 0, 0, size.width, size.height)
			const blob = await canvasToBlob(canvas, quality)
			if (blob.size <= PHOTO_TARGET_BYTES) {
				return { blob, base64: await blobToBase64(blob), ...size }
			}
		}
		throw new PhotoError('tooLarge')
	} finally {
		URL.revokeObjectURL(url)
	}
}
