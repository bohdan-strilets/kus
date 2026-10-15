export interface PutObjectInput {
	key: string
	body: Buffer
	contentType: string
}

export interface StoredObject {
	body: Buffer
	contentType: string
}

/** What a storage backend (R2, memory) must do. Errors surface as exceptions; a missing object is `null`. */
export interface StorageAdapter {
	putObject: (input: PutObjectInput) => Promise<void>
	getObject: (key: string) => Promise<StoredObject | null>
	deleteObject: (key: string) => Promise<void>
	/** Deletes every object whose key starts with `prefix`. */
	deleteByPrefix: (prefix: string) => Promise<void>
}

export type StorageKind = 'photos'
export type StorageVariant = 'full' | 'thumb'
