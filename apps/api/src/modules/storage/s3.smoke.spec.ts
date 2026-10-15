import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { envSchema } from '../../config/env.schema'
import { S3StorageAdapter } from './s3.adapter'

const SMOKE_TIMEOUT_MS = 60_000
const API_ENV_FILE = resolve(__dirname, '../../../.env')
// unrelated to storage but required by envSchema: placeholders keep the S3 errors readable
const UNRELATED_ENV_DEFAULTS: Record<string, string> = {
	DATABASE_URL: 'postgresql://smoke:smoke@localhost:5434/smoke',
	CORS_ORIGIN: 'http://localhost:5173',
	OPENROUTER_API_KEY: 'smoke',
	AI_MODEL: 'smoke/model',
	JWT_ACCESS_SECRET: 'smoke-access-secret-at-least-32-characters',
}

const loadApiEnvFile = (): void => {
	try {
		process.loadEnvFile(API_ENV_FILE)
	} catch (error) {
		// a missing file is fine (CI may pass real variables); validation below reports what is absent
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
	}
}

/** Same schema as the app; only variable names and issue codes are reported, never values. */
const readAdapterConfig = (): ConstructorParameters<typeof S3StorageAdapter>[0] => {
	const result = envSchema.safeParse({
		...UNRELATED_ENV_DEFAULTS,
		...process.env,
		NODE_ENV: 'test',
		STORAGE_PROVIDER: 's3',
	})
	if (!result.success) {
		const problems = result.error.issues.map((issue) => `${issue.path.join('.')} (${issue.code})`)
		throw new Error(`Invalid env for storage smoke test: ${problems.join(', ')}`)
	}
	const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET } = result.data
	if (!S3_ENDPOINT || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET) {
		throw new Error('Invalid env for storage smoke test: S3 variables are incomplete')
	}
	return {
		endpoint: S3_ENDPOINT,
		region: S3_REGION,
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
		bucket: S3_BUCKET,
	}
}

// Runs against a real bucket: skipped unless STORAGE_SMOKE=1 (`pnpm --filter api test:smoke:storage`).
describe.skipIf(process.env.STORAGE_SMOKE !== '1')('S3StorageAdapter smoke (real bucket)', () => {
	const runId = randomUUID()
	const prefix = `smoke/${runId}/`
	const neighbourPrefix = `smoke/${randomUUID()}/`
	const ownKeys: string[] = [
		`${prefix}a.bin`,
		`${prefix}nested/b b&c.bin`,
		`${prefix}nested/deep/c.bin`,
	]
	const firstKey = `${prefix}a.bin`
	const neighbourKey = `${neighbourPrefix}keep.bin`
	let adapter: S3StorageAdapter | undefined

	const useAdapter = (): S3StorageAdapter => {
		if (!adapter) throw new Error('Storage adapter is not initialised')
		return adapter
	}

	beforeAll(() => {
		loadApiEnvFile()
		adapter = new S3StorageAdapter(readAdapterConfig())
	})

	afterAll(async () => {
		if (!adapter) return
		await adapter.deleteByPrefix(prefix)
		await adapter.deleteByPrefix(neighbourPrefix)
	}, SMOKE_TIMEOUT_MS)

	it(
		'round-trips bytes and content type; a missing key is null',
		async () => {
			const body = Buffer.from([0, 1, 2, 250, 251, 252, 255])
			await useAdapter().putObject({ key: firstKey, body, contentType: 'image/jpeg' })

			const stored = await useAdapter().getObject(firstKey)
			expect(stored).not.toBeNull()
			expect(stored?.body.equals(body)).toBe(true)
			expect(stored?.contentType).toBe('image/jpeg')

			expect(await useAdapter().getObject(`${prefix}does-not-exist.bin`)).toBeNull()
		},
		SMOKE_TIMEOUT_MS,
	)

	it(
		'deleteByPrefix removes everything under the prefix and nothing else',
		async () => {
			await Promise.all(
				ownKeys.map((key, index) =>
					useAdapter().putObject({
						key,
						body: Buffer.from(`object-${index}`),
						contentType: 'application/octet-stream',
					}),
				),
			)
			await useAdapter().putObject({
				key: neighbourKey,
				body: Buffer.from('neighbour'),
				contentType: 'text/plain',
			})

			await useAdapter().deleteByPrefix(prefix)

			for (const key of ownKeys) {
				expect(await useAdapter().getObject(key)).toBeNull()
			}
			const neighbour = await useAdapter().getObject(neighbourKey)
			expect(neighbour?.body.toString()).toBe('neighbour')

			await useAdapter().deleteObject(neighbourKey)
			expect(await useAdapter().getObject(neighbourKey)).toBeNull()
		},
		SMOKE_TIMEOUT_MS,
	)
})
