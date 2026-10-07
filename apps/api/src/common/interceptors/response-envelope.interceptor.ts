import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import type { CursorMeta, PaginationMeta } from '@kus/shared'
import { map, Observable } from 'rxjs'

import { CursorPaginatedResult, PaginatedResult } from '../pagination'

export interface DataEnvelope<T> {
	data: T
}

export interface PaginatedEnvelope<T> {
	data: T[]
	meta: PaginationMeta | CursorMeta
}

type Envelope<T> = DataEnvelope<T> | PaginatedEnvelope<unknown>

const toEnvelope = <T>(result: T): Envelope<T> => {
	if (result instanceof PaginatedResult || result instanceof CursorPaginatedResult) {
		return { data: result.items, meta: result.meta }
	}
	return { data: result }
}

/** Wraps every successful response in `{ data }`, lists in `{ data, meta }` (CLAUDE.md §5). */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
	intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Envelope<T>> {
		return next.handle().pipe(map(toEnvelope))
	}
}
