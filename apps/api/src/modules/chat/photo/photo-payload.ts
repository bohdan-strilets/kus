import { inspect } from 'node:util'
import type { AiImageMimeType } from '@kus/shared'

const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * 1024

const formatSize = (sizeBytes: number): string =>
	sizeBytes >= BYTES_PER_MB
		? `${(sizeBytes / BYTES_PER_MB).toFixed(1)} MB`
		: `${(sizeBytes / BYTES_PER_KB).toFixed(1)} KB`

/**
 * A checked photo on its way to the model. Whatever prints it (JSON.stringify, a template string,
 * util.inspect, a logger given the whole object) gets `[image 1.2 MB]`, never the bytes
 * (CLAUDE.md §10.1). The bytes are read only through `bytes`, on purpose.
 */
export class PhotoPayload {
	readonly sizeBytes: number

	constructor(
		readonly mimeType: AiImageMimeType,
		readonly bytes: Buffer,
		readonly width: number,
		readonly height: number,
	) {
		this.sizeBytes = bytes.length
	}

	toString(): string {
		return `[image ${formatSize(this.sizeBytes)}]`
	}

	toJSON(): string {
		return this.toString()
	}

	[inspect.custom](): string {
		return this.toString()
	}
}
