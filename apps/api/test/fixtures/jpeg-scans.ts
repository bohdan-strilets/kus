import { JPEG_SENTINEL } from './jpeg'

// JPEGs with entropy-coded scans, built by hand, for the metadata stripper: no real pixels.
const MARKER_PREFIX = 0xff
const SOI = Buffer.from([0xff, 0xd8])
const EOI = Buffer.from([0xff, 0xd9])
const SOF0 = 0xc0
const SOF2 = 0xc2
const DHT = 0xc4
const SOS = 0xda
const APP0 = 0xe0
const COM = 0xfe
const RST0 = 0xd0

const segment = (marker: number, payload: Buffer): Buffer => {
	const header = Buffer.alloc(4)
	header[0] = MARKER_PREFIX
	header[1] = marker
	header.writeUInt16BE(payload.length + 2, 2)
	return Buffer.concat([header, payload])
}

const JFIF = Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')

const frame = (width: number, height: number): Buffer => {
	const payload = Buffer.alloc(9)
	payload[0] = 8
	payload.writeUInt16BE(height, 1)
	payload.writeUInt16BE(width, 3)
	payload[5] = 1
	payload[6] = 1
	payload[7] = 0x11
	return payload
}

/** Start of scan for one component; the entropy-coded bytes follow it. */
const scanHeader = (spectralEnd: number): Buffer =>
	segment(SOS, Buffer.from([1, 1, 0x00, 0, spectralEnd, 0]))

/** Scan data with a stuffed 0xFF00 and a restart marker, both of which are data, not markers. */
export const SCAN_DATA_A = Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, RST0, 0x56, 0x78])
export const SCAN_DATA_B = Buffer.from([0x9a, 0xbc, 0xff, 0x00, 0xde])
export const SCAN_DATA_C = Buffer.from([0xf0, 0x0f, 0x55])

export const SCANS_COMMENT = segment(COM, Buffer.from(JPEG_SENTINEL, 'latin1'))

interface ProgressiveJpegParts {
	jpeg: Buffer
	/** The same file without the comment between the scans: what a stripper must produce. */
	withoutComment: Buffer
}

/** A progressive JPEG: three scans, and a comment (with the sentinel) in front of the second. */
export const createProgressiveJpeg = (width = 640, height = 480): ProgressiveJpegParts => {
	const head = [
		SOI,
		segment(APP0, JFIF),
		segment(SOF2, frame(width, height)),
		segment(DHT, Buffer.alloc(8)),
	]
	const scanA = [scanHeader(0), SCAN_DATA_A]
	const scanB = [scanHeader(5), SCAN_DATA_B]
	const scanC = [scanHeader(63), SCAN_DATA_C, EOI]
	return {
		jpeg: Buffer.concat([...head, ...scanA, SCANS_COMMENT, ...scanB, ...scanC]),
		withoutComment: Buffer.concat([...head, ...scanA, ...scanB, ...scanC]),
	}
}

/** A scan that starts and never meets a marker: no next scan, no EOI. */
export const createJpegWithOpenScan = (width = 640, height = 480): Buffer =>
	Buffer.concat([
		SOI,
		segment(APP0, JFIF),
		segment(SOF0, frame(width, height)),
		scanHeader(63),
		Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55]),
	])
