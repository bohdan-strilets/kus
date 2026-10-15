import type { PutObjectInput, StorageAdapter, StoredObject } from './storage.types'

/** In-process storage for dev and tests: no network, gone on restart. */
export class MemoryStorageAdapter implements StorageAdapter {
	private readonly objects = new Map<string, StoredObject>()

	putObject = ({ key, body, contentType }: PutObjectInput): Promise<void> => {
		// a copy, so a caller reusing its buffer can't change what is "stored"
		this.objects.set(key, { body: Buffer.from(body), contentType })
		return Promise.resolve()
	}

	getObject = (key: string): Promise<StoredObject | null> => {
		const object = this.objects.get(key)
		if (!object) return Promise.resolve(null)
		return Promise.resolve({ body: Buffer.from(object.body), contentType: object.contentType })
	}

	deleteObject = (key: string): Promise<void> => {
		this.objects.delete(key)
		return Promise.resolve()
	}

	deleteByPrefix = (prefix: string): Promise<void> => {
		for (const key of this.objects.keys()) {
			if (key.startsWith(prefix)) this.objects.delete(key)
		}
		return Promise.resolve()
	}
}
