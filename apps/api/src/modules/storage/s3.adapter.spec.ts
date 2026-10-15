import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { S3StorageAdapter } from './s3.adapter'

const ENDPOINT = 'https://acct.example-s3.test'
const BUCKET = 'secret-bucket'
const REGION = 'eu-test-1'
const SECRET_KEY = 'dev/users/secret-user/photos/a b&c'

const listXml = (keys: string[], nextToken?: string): string =>
	`<?xml version="1.0"?><ListBucketResult><IsTruncated>${nextToken ? 'true' : 'false'}</IsTruncated>${keys
		.map((key) => `<Contents><Key>${key}</Key></Contents>`)
		.join(
			'',
		)}${nextToken ? `<NextContinuationToken>${nextToken}</NextContinuationToken>` : ''}</ListBucketResult>`

describe('S3StorageAdapter', () => {
	const fetchMock = vi.fn<(request: Request) => Promise<Response>>()
	let adapter: S3StorageAdapter

	const requests = (): Request[] => fetchMock.mock.calls.map((call) => call[0])

	beforeEach(() => {
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
		adapter = new S3StorageAdapter({
			endpoint: `${ENDPOINT}/`,
			region: REGION,
			accessKeyId: 'AKIDEXAMPLE',
			secretAccessKey: 'secret',
			bucket: BUCKET,
		})
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('puts with a path-style URL, per-segment key encoding, content type and a SigV4 signature', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

		await adapter.putObject({
			key: SECRET_KEY,
			body: Buffer.from([1, 2]),
			contentType: 'image/jpeg',
		})

		const request = requests()[0]
		expect(request?.method).toBe('PUT')
		expect(request?.url).toBe(`${ENDPOINT}/${BUCKET}/dev/users/secret-user/photos/a%20b%26c`)
		expect(request?.headers.get('content-type')).toBe('image/jpeg')
		const authorization = request?.headers.get('authorization') ?? ''
		expect(authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//)
		expect(authorization).toContain(`/${REGION}/s3/aws4_request`)
	})

	it('gets the body and content type', async () => {
		fetchMock.mockResolvedValue(
			new Response(new Uint8Array([7, 8]), {
				status: 200,
				headers: { 'content-type': 'image/png' },
			}),
		)

		const stored = await adapter.getObject('k')

		expect(stored?.body.equals(Buffer.from([7, 8]))).toBe(true)
		expect(stored?.contentType).toBe('image/png')
	})

	it('returns null for 404', async () => {
		fetchMock.mockResolvedValue(
			new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 }),
		)

		await expect(adapter.getObject('k')).resolves.toBeNull()
	})

	it('throws on 500 without the key, bucket or endpoint in the message', async () => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response('boom', { status: 500 })))

		const error: unknown = await adapter.getObject(SECRET_KEY).catch((caught: unknown) => caught)

		expect(error).toBeInstanceOf(Error)
		const message = (error as Error).message
		expect(message).toContain('500')
		for (const secret of ['secret', BUCKET, 'example-s3', 'acct']) {
			expect(message).not.toContain(secret)
		}
	})

	it('treats a missing object on delete as success and fails on other errors', async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
		await expect(adapter.deleteObject('k')).resolves.toBeUndefined()

		fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
		await expect(adapter.deleteObject('k')).rejects.toThrow()
	})

	it('deleteByPrefix follows pagination and unescapes XML keys', async () => {
		fetchMock.mockImplementation((request) => {
			if (request.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
			const token = new URL(request.url).searchParams.get('continuation-token')
			return Promise.resolve(
				new Response(
					token === 'tok&1' ? listXml(['p/b']) : listXml(['p/a&amp;b', 'p/c&lt;d'], 'tok&amp;1'),
				),
			)
		})

		await adapter.deleteByPrefix('p/')

		const lists = requests().filter((request) => request.method === 'GET')
		expect(lists).toHaveLength(2)
		const first = new URL(lists[0]?.url ?? '')
		expect(first.searchParams.get('prefix')).toBe('p/')
		expect(first.searchParams.get('list-type')).toBe('2')
		expect(new URL(lists[1]?.url ?? '').searchParams.get('continuation-token')).toBe('tok&1')
		const deleted = requests()
			.filter((request) => request.method === 'DELETE')
			.map((request) => decodeURIComponent(new URL(request.url).pathname))
		expect(deleted.sort()).toEqual([`/${BUCKET}/p/a&b`, `/${BUCKET}/p/b`, `/${BUCKET}/p/c<d`])
	})

	it('deleteByPrefix with an empty listing deletes nothing', async () => {
		fetchMock.mockResolvedValue(new Response(listXml([])))

		await adapter.deleteByPrefix('p/')

		expect(fetchMock).toHaveBeenCalledTimes(1)
	})
})
