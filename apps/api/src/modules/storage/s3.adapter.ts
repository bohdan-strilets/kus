import { AwsClient } from 'aws4fetch'

import { parseListObjectsPage, type ListObjectsPage } from './s3-xml'
import {
	STORAGE_DELETE_TIMEOUT_MS,
	STORAGE_LIST_TIMEOUT_MS,
	STORAGE_RETRIES,
	STORAGE_TRANSFER_TIMEOUT_MS,
} from './storage.constants'
import type { PutObjectInput, StorageAdapter, StoredObject } from './storage.types'

const S3_SERVICE = 's3'
const DELETE_CONCURRENCY = 10
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

export interface S3AdapterConfig {
	endpoint: string
	region: string
	accessKeyId: string
	secretAccessKey: string
	bucket: string
}

/**
 * Any S3-compatible store (Cloudflare R2, Backblaze B2, ...), path-style, signed with SigV4.
 * Errors carry only the HTTP status: the key, bucket and endpoint must not reach logs.
 */
export class S3StorageAdapter implements StorageAdapter {
	private readonly client: AwsClient
	private readonly baseUrl: string

	constructor({ endpoint, region, accessKeyId, secretAccessKey, bucket }: S3AdapterConfig) {
		this.client = new AwsClient({
			accessKeyId,
			secretAccessKey,
			region,
			service: S3_SERVICE,
			retries: STORAGE_RETRIES,
		})
		this.baseUrl = `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(bucket)}`
	}

	putObject = async ({ key, body, contentType }: PutObjectInput): Promise<void> => {
		const response = await this.send(this.objectUrl(key), {
			method: 'PUT',
			headers: { 'Content-Type': contentType },
			body: new Uint8Array(body),
		})
		this.assertOk(response, 'put')
	}

	getObject = async (key: string): Promise<StoredObject | null> => {
		const response = await this.send(this.objectUrl(key), { method: 'GET' })
		if (response.status === 404) return null
		this.assertOk(response, 'get')
		return {
			body: Buffer.from(await response.arrayBuffer()),
			contentType: response.headers.get('content-type') ?? DEFAULT_CONTENT_TYPE,
		}
	}

	deleteObject = async (key: string): Promise<void> => {
		const response = await this.send(
			this.objectUrl(key),
			{ method: 'DELETE' },
			STORAGE_DELETE_TIMEOUT_MS,
		)
		if (response.status === 404) return
		this.assertOk(response, 'delete')
	}

	deleteByPrefix = async (prefix: string): Promise<void> => {
		let token: string | null = null
		do {
			const page: ListObjectsPage = await this.listPage(prefix, token)
			for (let index = 0; index < page.keys.length; index += DELETE_CONCURRENCY) {
				const batch = page.keys.slice(index, index + DELETE_CONCURRENCY)
				await Promise.all(batch.map((key) => this.deleteObject(key)))
			}
			token = page.nextToken
		} while (token !== null)
	}

	private listPage = async (prefix: string, token: string | null): Promise<ListObjectsPage> => {
		const query = new URLSearchParams({ 'list-type': '2', prefix })
		if (token !== null) query.set('continuation-token', token)
		const response = await this.send(
			`${this.baseUrl}?${query.toString()}`,
			{ method: 'GET' },
			STORAGE_LIST_TIMEOUT_MS,
		)
		this.assertOk(response, 'list')
		return parseListObjectsPage(await response.text())
	}

	/** The key is encoded per segment: `/` stays a separator, everything else is escaped. */
	private objectUrl = (key: string): string =>
		`${this.baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`

	private send = (
		url: string,
		init: RequestInit,
		timeoutMs: number = STORAGE_TRANSFER_TIMEOUT_MS,
	): Promise<Response> =>
		this.client.fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })

	private assertOk = (response: Response, operation: string): void => {
		if (response.ok) return
		throw new Error(`S3 ${operation} failed with status ${response.status}`)
	}
}
