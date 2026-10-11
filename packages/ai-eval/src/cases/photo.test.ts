import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getImageTokens, loadEvalPhoto } from './photo.js'

/** A JPEG skeleton that a header reader accepts: SOI, JFIF, a frame with the size, EOI. */
const createJpeg = (width: number, height: number): Buffer => {
	const segment = (marker: number, payload: Buffer): Buffer => {
		const header = Buffer.alloc(4)
		header[0] = 0xff
		header[1] = marker
		header.writeUInt16BE(payload.length + 2, 2)
		return Buffer.concat([header, payload])
	}
	const frame = Buffer.alloc(9)
	frame[0] = 8
	frame.writeUInt16BE(height, 1)
	frame.writeUInt16BE(width, 3)
	frame[5] = 1
	frame[6] = 1
	frame[7] = 0x11
	frame[8] = 0
	return Buffer.concat([
		Buffer.from([0xff, 0xd8]),
		segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
		segment(0xc0, frame),
		Buffer.from([0xff, 0xd9]),
	])
}

describe('getImageTokens', () => {
	it('counts 28-px patches, rounded up per side', () => {
		expect(getImageTokens(1568, 1176)).toBe(56 * 42)
		expect(getImageTokens(29, 29)).toBe(4)
	})
})

describe('loadEvalPhoto', () => {
	let dir: string
	const warn = vi.fn()

	beforeAll(async () => {
		dir = await mkdtemp(join(tmpdir(), 'kus-eval-photo-'))
		await writeFile(join(dir, 'label.jpg'), createJpeg(1200, 900))
		await writeFile(join(dir, 'huge.JPEG'), createJpeg(4032, 3024))
		await writeFile(join(dir, 'note.txt'), 'not a photo')
	})

	afterAll(async () => {
		await rm(dir, { recursive: true, force: true })
	})

	it('reads the type from the extension and the size from the file', async () => {
		const photo = await loadEvalPhoto(dir, 'label.jpg', warn)
		expect(photo).toMatchObject({ mimeType: 'image/jpeg', width: 1200, height: 900 })
		expect(Buffer.from(photo.base64, 'base64').subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))
		expect(warn).not.toHaveBeenCalled()
	})

	it('warns about a photo bigger than the app would send, but still loads it', async () => {
		const photo = await loadEvalPhoto(dir, 'huge.JPEG', warn)
		expect(photo.width).toBe(4032)
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('4032×3024'))
	})

	it('refuses a file that is not an image', async () => {
		await expect(loadEvalPhoto(dir, 'note.txt', warn)).rejects.toThrow('.jpg, .png or .webp')
	})
})
