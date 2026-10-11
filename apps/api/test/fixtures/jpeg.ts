// A JPEG skeleton: enough for a header reader (image-size) and for the metadata stripper, no pixels.
export const JPEG_SENTINEL = 'KUSIK-SENTINEL-7f3a'

const SOI = Buffer.from([0xff, 0xd8])
const EOI = Buffer.from([0xff, 0xd9])

const segment = (marker: number, payload: Buffer): Buffer => {
	const header = Buffer.alloc(4)
	header[0] = 0xff
	header[1] = marker
	// the length counts its own two bytes
	header.writeUInt16BE(payload.length + 2, 2)
	return Buffer.concat([header, payload])
}

const JFIF = Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')

interface CreateJpegOptions {
	width?: number
	height?: number
	/** Put the sentinel text into APP1 (EXIF) and COM, where a leak would carry it out. */
	hasSentinel?: boolean
}

export const createJpeg = ({
	width = 640,
	height = 480,
	hasSentinel = false,
}: CreateJpegOptions = {}): Buffer => {
	const frame = Buffer.alloc(6 + 3)
	frame[0] = 8 // sample precision
	frame.writeUInt16BE(height, 1)
	frame.writeUInt16BE(width, 3)
	frame[5] = 1 // one component: id 1, sampling 1x1, quantization table 0
	frame[6] = 1
	frame[7] = 0x11
	frame[8] = 0
	const metadata = hasSentinel
		? [
				segment(0xe1, Buffer.from(`Exif\0\0${JPEG_SENTINEL}`, 'latin1')),
				segment(0xfe, Buffer.from(JPEG_SENTINEL, 'latin1')),
			]
		: []
	return Buffer.concat([SOI, segment(0xe0, JFIF), ...metadata, segment(0xc0, frame), EOI])
}

export const toBase64 = (bytes: Buffer): string => bytes.toString('base64')
