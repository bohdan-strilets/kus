import { type CallHandler, type ExecutionContext, StreamableFile } from '@nestjs/common'
import { firstValueFrom, of } from 'rxjs'
import { describe, expect, it } from 'vitest'

import { PaginatedResult } from '../pagination'
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor'

const run = (value: unknown): Promise<unknown> => {
	const handler: CallHandler = { handle: () => of(value) }
	return firstValueFrom(
		new ResponseEnvelopeInterceptor().intercept({} as ExecutionContext, handler),
	)
}

describe('ResponseEnvelopeInterceptor', () => {
	it('passes a StreamableFile through untouched', async () => {
		const file = new StreamableFile(Buffer.from('bytes'), { type: 'image/jpeg', length: 5 })

		const result = await run(file)

		expect(result).toBe(file)
		expect(result).not.toHaveProperty('data')
	})

	it('wraps a plain object in { data }', async () => {
		expect(await run({ id: 'a' })).toEqual({ data: { id: 'a' } })
	})

	it.each([[null], [undefined], [[]], ['text'], [0]])('wraps %s in { data }', async (value) => {
		expect(await run(value)).toEqual({ data: value })
	})

	it('wraps a Buffer (not a StreamableFile) in { data }', async () => {
		const bytes = Buffer.from('x')

		expect(await run(bytes)).toEqual({ data: bytes })
	})

	it('wraps a paginated result in { data, meta }', async () => {
		const meta = { total: 1, page: 1, limit: 20, totalPages: 1 }

		expect(await run(new PaginatedResult([{ id: 1 }], meta))).toEqual({
			data: [{ id: 1 }],
			meta,
		})
	})
})
