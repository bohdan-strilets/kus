// Test-only: tells whether a JPEG still carries the camera's Exif block (compressImage drops it).
const MARKER_PREFIX = 0xff
const SOI = 0xd8
const SOS = 0xda
const APP1 = 0xe1
const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0x00]
const SEGMENT_HEADER_BYTES = 4
const EXIF_ID_OFFSET = 4

/** True when the JPEG carries an Exif block (APP1) ahead of the scan: the camera's metadata. */
export const hasJpegExif = (bytes: Uint8Array): boolean => {
	if (bytes[0] !== MARKER_PREFIX || bytes[1] !== SOI) return false
	let offset = 2
	while (offset + SEGMENT_HEADER_BYTES <= bytes.length) {
		if (bytes[offset] !== MARKER_PREFIX) return false
		const marker = bytes[offset + 1]
		if (marker === SOS) return false
		if (marker === APP1) {
			return EXIF_ID.every((byte, index) => bytes[offset + EXIF_ID_OFFSET + index] === byte)
		}
		const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)
		offset += 2 + length
	}
	return false
}
