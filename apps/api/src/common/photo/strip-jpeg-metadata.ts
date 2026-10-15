import type { AiImageMimeType } from '@kus/shared'

const MARKER_PREFIX = 0xff
const SOI = 0xd8
const EOI = 0xd9
const SOS = 0xda
const TEM = 0x01
const RST_FIRST = 0xd0
const RST_LAST = 0xd7
const APP1 = 0xe1
const APP15 = 0xef
const COM = 0xfe
const MARKER_BYTES = 2
const LENGTH_FIELD_BYTES = 2

const hasNoLength = (marker: number): boolean =>
	marker === TEM || marker === SOI || (marker >= RST_FIRST && marker <= RST_LAST)

// APP0 (JFIF) stays; APP1 holds EXIF (GPS) and XMP, the rest are vendor blocks and comments
const isMetadata = (marker: number): boolean =>
	(marker >= APP1 && marker <= APP15) || marker === COM

/**
 * Offset of the first real marker in scan data: FF00 (stuffed byte), RSTn and FF fill bytes
 * belong to the data. `null` = the data runs to the end of the file without a marker.
 */
const findScanEnd = (bytes: Buffer, start: number): number | null => {
	let offset = start
	while (offset < bytes.length) {
		if (bytes[offset] !== MARKER_PREFIX) {
			offset += 1
			continue
		}
		const next = bytes[offset + 1]
		if (next === undefined) return null
		if (next === 0x00 || (next >= RST_FIRST && next <= RST_LAST)) {
			offset += MARKER_BYTES
			continue
		}
		if (next === MARKER_PREFIX) {
			offset += 1
			continue
		}
		return offset
	}
	return null
}

/**
 * Cuts APP1…APP15 and COM out of a JPEG (EXIF with GPS, XMP, ICC, comments) before the bytes go
 * anywhere. The client already re-encodes the photo; this is the server's own guarantee.
 * PNG and WebP are returned as is. `null` = the JPEG structure is broken.
 */
export const stripJpegMetadata = (bytes: Buffer, mimeType: AiImageMimeType): Buffer | null => {
	if (mimeType !== 'image/jpeg') return bytes
	if (bytes[0] !== MARKER_PREFIX || bytes[1] !== SOI) return null

	const kept: Buffer[] = [bytes.subarray(0, MARKER_BYTES)]
	let offset = MARKER_BYTES
	while (offset < bytes.length) {
		if (bytes[offset] !== MARKER_PREFIX) return null
		const marker = bytes[offset + 1]
		if (marker === undefined) return null
		// fill bytes before a marker
		if (marker === MARKER_PREFIX) {
			offset += 1
			continue
		}
		if (marker === EOI) {
			// whatever follows EOI (an appended EXIF, hidden data) is not part of the image
			kept.push(bytes.subarray(offset, offset + MARKER_BYTES))
			return Buffer.concat(kept)
		}
		if (hasNoLength(marker)) {
			kept.push(bytes.subarray(offset, offset + MARKER_BYTES))
			offset += MARKER_BYTES
			continue
		}
		if (offset + MARKER_BYTES + LENGTH_FIELD_BYTES > bytes.length) return null
		// the length counts its own two bytes but not the marker
		const end = offset + MARKER_BYTES + bytes.readUInt16BE(offset + MARKER_BYTES)
		if (end > bytes.length) return null
		if (!isMetadata(marker)) kept.push(bytes.subarray(offset, end))
		offset = end
		if (marker !== SOS) continue

		// the entropy-coded data holds no metadata: keep it up to the next real marker
		const scanEnd = findScanEnd(bytes, offset)
		if (scanEnd === null) return null
		kept.push(bytes.subarray(offset, scanEnd))
		offset = scanEnd
	}
	return null
}
